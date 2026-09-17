'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type ActionState, InputError, guard, oneOf, requiredText, requiredUuid, text } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { canPublish } from '@/lib/marketing/content/approvals';
import { latestApproval, loadSubject, submitForApproval } from '@/lib/marketing/content/approvals-service';
import { checkContent } from '@/lib/marketing/content/compliance';
import { adminDb, toJson } from '@/lib/marketing/content/db';
import { auditNap, parseFaq, parseSections, type SeoSection } from '@/lib/marketing/content/seo';
import { SERVICE_AREAS } from '@/lib/marketing/content/seo-local';
import {
  checkSeoGuard, generateAreaPageDraft, generateBuildPageDraft, generateJobBlogDraft, generateServiceFaqDraft, generateTopicBlogDraft,
} from '@/lib/marketing/content/seo-service';
import { importSearchData, pullGbpProfile, pushGbpProfile, saveGbpProfile } from '@/lib/marketing/content/seo-search-service';
import { DESCRIPTION_MAX } from '@/lib/marketing/content/gbp-profile';
import { PLATFORMS } from '@/lib/site';

const LISTING_STATUSES = ['not_started', 'claimed', 'verified', 'needs_update', 'not_applicable'] as const;
const TASK_STATUSES = ['todo', 'done', 'skip'] as const;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function refresh(id?: string) {
  revalidatePath('/admin/marketing/content');
  revalidatePath('/admin/marketing/ads/approvals');
  for (const path of ['/blog', '/faq', '/service-areas']) revalidatePath(path, 'layout');
  revalidatePath('/sitemap.xml');
  if (id) revalidatePath(`/admin/marketing/content/${id}`);
}

/** Generates a build page, blog post, FAQ or service-area draft and opens it. */
export async function generateSeo(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  let seoId = '';
  const state = await guard(async () => {
    const kind = oneOf(form, 'kind', ['build_page', 'blog_post', 'topic_post', 'faq', 'area_page'] as const, 'draft type');
    const platformIds = PLATFORMS.map((p) => p.id);
    const result = kind === 'build_page'
      ? await generateBuildPageDraft(requiredUuid(form, 'buildId', 'Build'), viewer.userId)
      : kind === 'blog_post'
        ? await generateJobBlogDraft(requiredUuid(form, 'workOrderId', 'Job'), viewer.userId)
        : kind === 'topic_post'
          ? await generateTopicBlogDraft(
            requiredText(form, 'topic', 'Topic', 110),
            form.get('platform') ? oneOf(form, 'platform', platformIds, 'truck') : null,
            viewer.userId,
          )
          : kind === 'area_page'
            ? await generateAreaPageDraft(oneOf(form, 'area', SERVICE_AREAS.map((a) => a.slug), 'town'), viewer.userId)
            : await generateServiceFaqDraft(viewer.userId);
    if (!result.ok) throw new InputError(result.error);
    seoId = result.data.seoId;
    return {};
  });
  if (state.error) return state;
  refresh();
  redirect(`/admin/marketing/content/${seoId}`);
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
    const wasLive = row.status === 'published';
    const report = checkContent([title, summary, meta, ...body.flatMap((s) => [s.heading, s.text]), ...faq.flatMap((f) => [f.q, f.a])]);
    const { error } = await db.from('seo_content').update({
      title, summary, meta_description: meta, body: toJson(body), faq: toJson(faq), status: 'draft', generator: 'manual', published_at: null,
      compliance_status: report.status, compliance_issues: toJson(report.issues),
    }).eq('id', id);
    if (error) throw new Error(error.message);
    refresh(id);
    if (report.status === 'block') return { notice: 'Saved as draft. Blocked wording can’t be approved.' };
    const queued = await submitForApproval('seo_content', id, viewer.userId, db);
    if (!queued.ok) throw new InputError(queued.error);
    return { notice: wasLive ? 'Taken offline and sent for approval.' : 'Saved and sent for approval.' };
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
    const scaled = await checkSeoGuard(id, db);
    if (scaled && !scaled.ok) throw new InputError(scaled.issues.join(' '));

    let notice = row.kind === 'blog_post' ? 'Live on the blog.' : row.kind === 'faq' ? 'Live on the FAQ page.' : row.kind === 'area_page' ? 'Live on service areas.' : 'Published.';
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
    const { error } = await db.from('seo_content').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', id);
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
    // What the directory actually shows, so the NAP audit compares real values.
    const nap = {
      name: text(form, 'nap_name', { max: 120, label: 'Listed name' }) ?? '',
      phone: text(form, 'nap_phone', { max: 40, label: 'Listed phone' }) ?? '',
      website: text(form, 'nap_website', { max: 300, label: 'Listed website' }) ?? '',
      address: text(form, 'nap_address', { max: 200, label: 'Listed address' }),
    };
    const entered = Boolean(nap.name || nap.phone || nap.website || nap.address);
    const audit = entered ? auditNap(nap) : null;
    const { error } = await adminDb().from('listings').update({
      status, url, last_checked_at: new Date().toISOString(),
      ...(entered ? { nap: toJson(nap), nap_consistent: audit?.consistent ?? null } : {}),
    }).eq('id', id);
    if (error) throw new Error(error.message);
    refresh();
    return { notice: entered && audit && !audit.consistent ? `Saved. Fix on the directory: ${audit.mismatches.join(', ')}.` : 'Listing updated.' };
  });
}

export async function updateSeoTask(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'id', 'Task');
    const status = oneOf(form, 'status', TASK_STATUSES, 'status');
    const notes = text(form, 'notes', { max: 500, label: 'Notes' });
    const url = text(form, 'url', { max: 300, label: 'Link' });
    if (url && !/^https:\/\/[^\s]+$/i.test(url)) throw new InputError('Link must start with https://');
    const { data, error } = await adminDb().from('seo_tasks').update({ status, notes, url, done_at: status === 'done' ? new Date().toISOString() : null }).eq('id', id).select('id').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new InputError('Task not found.');
    refresh();
    return { notice: 'Task saved.' };
  });
}

function day(form: FormData, name: string, label: string): string {
  const value = requiredText(form, name, label, 10);
  if (!DAY_RE.test(value) || Number.isNaN(Date.parse(`${value}T12:00:00Z`))) throw new InputError(`${label} is not a valid date.`);
  return value;
}

export async function addClosure(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const label = requiredText(form, 'label', 'Name', 80);
    const startsOn = day(form, 'starts_on', 'Start');
    const endsOn = form.get('ends_on') ? day(form, 'ends_on', 'End') : startsOn;
    if (endsOn < startsOn) throw new InputError('End date is before the start.');
    const message = text(form, 'message', { max: 200, label: 'Message' });
    const closed = oneOf(form, 'mode', ['closed', 'special'] as const, 'hours') === 'closed';
    const { error } = await adminDb().from('shop_closures').insert({ label, starts_on: startsOn, ends_on: endsOn, message, closed });
    if (error) throw new Error(error.message);
    refresh();
    revalidatePath('/', 'layout');
    return { notice: 'Added. The site banner shows it a week ahead.' };
  });
}

export async function deleteClosure(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'id', 'Closure');
    const { error } = await adminDb().from('shop_closures').delete().eq('id', id);
    if (error) throw new Error(error.message);
    refresh();
    revalidatePath('/', 'layout');
    return { notice: 'Removed.' };
  });
}

/** Business Profile record the owner keeps here; pushed to Google when connected. */
export async function saveProfile(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const result = await saveGbpProfile({
      description: text(form, 'description', { max: DESCRIPTION_MAX, label: 'Description' }),
      primaryCategory: text(form, 'primary_category', { max: 80, label: 'Category' }),
      services: text(form, 'services', { max: 1000, label: 'Services' }),
      hoursNote: text(form, 'hours_note', { max: 200, label: 'Hours note' }),
    });
    if (!result.ok) throw new InputError(result.error);
    refresh();
    return { notice: 'Profile saved.' };
  });
}

export async function pushProfile(): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const result = await pushGbpProfile();
    if (!result.ok) throw new InputError(result.error);
    refresh();
    return { notice: result.data.note };
  });
}

export async function pullProfile(): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const result = await pullGbpProfile();
    if (!result.ok) throw new InputError(result.error);
    refresh();
    return { notice: result.data.note };
  });
}

/** Imports Business Profile and Search Console numbers, or sample data until connected. */
export async function importSearch(): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const result = await importSearchData();
    if (!result.ok) throw new InputError(result.error);
    const { gbp, gsc } = result.data;
    refresh();
    return { notice: gbp.live || gsc.live ? `Imported ${gbp.rows + gsc.rows} days.` : `Sample data loaded (${gsc.note}).` };
  });
}
