'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type ActionState, InputError, guard, oneOf, requiredText, requiredUuid, text } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { canPublish } from '@/lib/marketing/content/approvals';
import { latestApproval, loadSubject, submitForApproval } from '@/lib/marketing/content/approvals-service';
import { checkContent } from '@/lib/marketing/content/compliance';
import { adminDb, toJson } from '@/lib/marketing/content/db';
import type { FaqItem, SeoSection } from '@/lib/marketing/content/seo';
import { generateBuildPageDraft, generateJobBlogDraft, generateServiceFaqDraft } from '@/lib/marketing/content/seo-service';

const LISTING_STATUSES = ['not_started', 'claimed', 'verified', 'needs_update', 'not_applicable'] as const;

function refresh(id?: string) {
  revalidatePath('/admin/marketing/content');
  revalidatePath('/admin/marketing/ads/approvals');
  if (id) revalidatePath(`/admin/marketing/content/${id}`);
}

/** Generates a build page, blog post or FAQ draft and opens it. */
export async function generateSeo(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  let seoId = '';
  const state = await guard(async () => {
    const kind = oneOf(form, 'kind', ['build_page', 'blog_post', 'faq'] as const, 'draft type');
    const result = kind === 'build_page'
      ? await generateBuildPageDraft(requiredUuid(form, 'buildId', 'Build'), viewer.userId)
      : kind === 'blog_post'
        ? await generateJobBlogDraft(requiredUuid(form, 'workOrderId', 'Job'), viewer.userId)
        : await generateServiceFaqDraft(viewer.userId);
    if (!result.ok) throw new InputError(result.error);
    seoId = result.data.seoId;
    return {};
  });
  if (state.error) return state;
  refresh();
  redirect(`/admin/marketing/content/${seoId}`);
}

/** "## Heading" blocks → sections. */
function parseSections(raw: string): SeoSection[] {
  return raw.split(/^##\s+/m).map((block) => block.trim()).filter(Boolean).map((block) => {
    const [heading, ...rest] = block.split('\n');
    return { heading: heading!.trim().slice(0, 120), text: rest.join('\n').trim() };
  });
}

/** "Q: …" / "A: …" pairs → FAQ. */
function parseFaq(raw: string): FaqItem[] {
  return raw.split(/^Q:\s*/m).map((b) => b.trim()).filter(Boolean).map((block) => {
    const [q, a = ''] = block.split(/^A:\s*/m);
    return { q: q!.trim(), a: a.trim() };
  }).filter((f) => f.q && f.a);
}

export async function saveSeo(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'id', 'Draft');
    const title = requiredText(form, 'title', 'Title', 120);
    const summary = requiredText(form, 'summary', 'Summary', 600);
    const meta = requiredText(form, 'meta', 'Search snippet', 160);
    const body = parseSections(text(form, 'body', { max: 20_000, label: 'Body' }) ?? '');
    const faq = parseFaq(text(form, 'faq', { max: 8_000, label: 'FAQ' }) ?? '');
    if (!body.length) throw new InputError('Add at least one “## Heading” section.');

    const db = adminDb();
    const { data: row } = await db.from('seo_content').select('status').eq('id', id).maybeSingle();
    if (!row) throw new InputError('Draft not found.');
    if (row.status === 'published') throw new InputError('Already published. Generate a new draft to change it.');
    const report = checkContent([title, summary, meta, ...body.flatMap((s) => [s.heading, s.text]), ...faq.flatMap((f) => [f.q, f.a])]);
    const { error } = await db.from('seo_content').update({
      title, summary, meta_description: meta, body: toJson(body), faq: toJson(faq), status: 'draft', generator: 'manual',
      compliance_status: report.status, compliance_issues: toJson(report.issues),
    }).eq('id', id);
    if (error) throw new Error(error.message);
    refresh(id);
    if (report.status === 'block') return { notice: 'Saved as draft. Blocked wording can’t be approved.' };
    const queued = await submitForApproval('seo_content', id, viewer.userId, db);
    if (!queued.ok) throw new InputError(queued.error);
    return { notice: 'Saved and sent for approval.' };
  });
}

/** Approved build pages update the build's public story; blog posts and FAQs are marked ready. */
export async function publishSeo(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'id', 'Draft');
    const db = adminDb();
    const [snapshot, approval, { data: row }] = await Promise.all([
      loadSubject(db, 'seo_content', id),
      latestApproval(db, 'seo_content', id),
      db.from('seo_content').select('*').eq('id', id).maybeSingle(),
    ]);
    if (!snapshot || !row) throw new InputError('Draft not found.');
    const gate = canPublish({ status: snapshot.status, approval, payload: snapshot.payload, compliance: snapshot.compliance, warningsAcknowledged: approval?.warningsAcknowledged ?? false });
    if (!gate.ok) throw new InputError(gate.reason);

    let notice = 'Marked ready to post.';
    if (row.kind === 'build_page') {
      const sections = (Array.isArray(row.body) ? row.body : []) as unknown as SeoSection[];
      const story = sections.map((s) => `${s.heading}\n${s.text}`).join('\n\n');
      const { data: build } = row.source_type === 'build' && row.source_id
        ? await db.from('builds').select('id, hero_image, vehicle_label, platform').eq('id', row.source_id).maybeSingle()
        : { data: null };
      if (build) {
        const { error } = await db.from('builds').update({ summary: row.summary, story, published: true }).eq('id', build.id);
        if (error) throw new Error(error.message);
        notice = 'Published to the build page.';
      } else {
        const { error } = await db.from('builds').insert({ slug: row.slug, title: row.title, summary: row.summary, story, vehicle_label: 'Customer truck', platform: 'other', hero_image: '/images/shop-card.jpg', published: false });
        if (error) throw new Error(error.message);
        notice = 'Build created (hidden). Add a photo, then show it.';
      }
      revalidatePath('/builds', 'layout');
    }
    const { error } = await db.from('seo_content').update({ status: 'published' }).eq('id', id);
    if (error) throw new Error(error.message);
    refresh(id);
    return { notice };
  });
}

export async function updateListing(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'id', 'Listing');
    const status = oneOf(form, 'status', LISTING_STATUSES, 'status');
    const url = text(form, 'url', { max: 300, label: 'Link' });
    if (url && !/^https:\/\/[^\s]+$/i.test(url)) throw new InputError('Link must start with https://');
    const { error } = await adminDb().from('listings').update({ status, url, last_checked_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    refresh();
    return { notice: 'Listing updated.' };
  });
}
