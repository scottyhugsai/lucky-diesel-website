'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkbox, guard, requiredText, requiredUuid, text, uuid, type ActionState } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { decideApproval, submitForApproval } from '@/lib/marketing/content/approvals-service';
import { checkContent } from '@/lib/marketing/content/compliance';
import { toJson } from '@/lib/marketing/content/db';
import { blocksText, validateBlocks, type LandingBlock } from '@/lib/marketing/content/landing-blocks';
import { createShortLink } from '@/lib/marketing/core/links';
import { createAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/marketing/pages';
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function refresh(slug?: string) {
  revalidatePath(PATH, 'layout');
  revalidatePath('/offers');
  if (slug) revalidatePath(`/l/${slug}`);
}

function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export async function createLanding(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  let createdId: string | null = null;
  const state = await guard(async () => {
    const title = requiredText(form, 'title', 'Title', 80);
    const slug = toSlug(text(form, 'slug', { max: 60, label: 'Link' }) ?? title);
    if (!SLUG.test(slug)) return { error: 'Link: letters, numbers and dashes.' };
    const blocks: LandingBlock[] = [
      { type: 'hero', kicker: null, headline: title, subhead: null, image: null, ctaLabel: 'Claim it' },
      { type: 'form', heading: 'Claim it', service: 'maintenance', offerTag: slug, submitLabel: 'Send' },
    ];
    const { data, error } = await createAdminClient().from('landing_pages').insert({ slug, title, blocks: toJson(blocks), generator: 'manual' }).select('id').single();
    if (error || !data) return { error: error?.code === '23505' ? 'That link is taken.' : 'Couldn’t create the page.' };
    createdId = data.id;
    return { notice: 'Created.' };
  });
  if (createdId) redirect(`${PATH}/${createdId}`);
  return state;
}

export async function saveLanding(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'page_id', 'Page');
    const title = requiredText(form, 'title', 'Title', 80);
    const description = text(form, 'seo_description', { max: 200, label: 'Search blurb' });
    const magnetId = uuid(form, 'lead_magnet_id', { required: false, label: 'Checklist' });
    let raw: unknown;
    try {
      raw = JSON.parse(requiredText(form, 'blocks', 'Blocks', 50_000));
    } catch {
      return { error: 'Blocks could not be read.' };
    }
    const parsed = validateBlocks(raw);
    if (!parsed.ok) return { error: `Fix first: ${parsed.errors.slice(0, 3).join('; ')}.` };
    const compliance = checkContent([title, description, ...blocksText(parsed.blocks)]);
    if (compliance.status === 'block') return { error: `Copy blocked: ${compliance.issues.filter((i) => i.severity === 'block').map((i) => i.reason).join(' ')}` };
    const offer = parsed.blocks.find((b) => b.type === 'offer');
    const db = createAdminClient();
    const { data, error } = await db.from('landing_pages').update({
      title, seo_description: description, lead_magnet_id: magnetId, blocks: toJson(parsed.blocks), updated_at: new Date().toISOString(),
      offer: offer && offer.type === 'offer' ? toJson({ headline: offer.headline, valueLabel: offer.valueLabel, terms: offer.terms, code: offer.code, endsAt: offer.endsAt }) : null,
    }).eq('id', id).select('slug').single();
    if (error || !data) return { error: 'Couldn’t save.' };
    refresh(data.slug);
    return { notice: compliance.status === 'warn' ? `Saved. Review: ${compliance.issues.map((i) => i.term).join(', ')}.` : 'Saved.' };
  });
}

export async function setLandingPublished(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'page_id', 'Page');
    const publish = checkbox(form, 'publish');
    const db = createAdminClient();
    const { data: page } = await db.from('landing_pages').select('slug, title, blocks, seo_description').eq('id', id).maybeSingle();
    if (!page) return { error: 'Page not found.' };
    if (!publish) {
      const { error } = await db.from('landing_pages').update({ published: false }).eq('id', id);
      if (error) return { error: 'Couldn’t unpublish.' };
      refresh(page.slug);
      return { notice: 'Unpublished.' };
    }
    const parsed = validateBlocks(page.blocks);
    if (!parsed.ok) return { error: `Fix first: ${parsed.errors.slice(0, 3).join('; ')}.` };
    const compliance = checkContent([page.title, page.seo_description, ...blocksText(parsed.blocks)]);
    if (compliance.status === 'block') return { error: 'Copy is blocked. Edit and save first.' };
    const queued = await submitForApproval('landing_page', id, viewer.userId);
    if (queued.ok) {
      const decided = await decideApproval({ approvalId: queued.data.approvalId, decision: 'approved', decidedBy: viewer.userId, acknowledgeWarnings: true });
      if (!decided.ok) return { error: decided.error };
    } else {
      // Already approved once (e.g. unpublished later): the owner is the approver, so republish directly.
      const { error } = await db.from('landing_pages').update({ published: true, published_at: new Date().toISOString() }).eq('id', id);
      if (error) return { error: queued.error };
    }
    refresh(page.slug);
    return { notice: 'Live.' };
  });
}

export async function makeShortLink(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const target = requiredText(form, 'target', 'Link', 500);
    if (!target.startsWith('/l/')) return { error: 'Build the link first.' };
    const result = await createShortLink({ targetUrl: target, utmSource: text(form, 'utm_source', { max: 60 }), utmMedium: text(form, 'utm_medium', { max: 60 }) });
    if (!result.ok) return { error: result.error };
    return { notice: result.url };
  });
}

export async function createMagnet(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const title = requiredText(form, 'title', 'Title', 80);
    const description = requiredText(form, 'description', 'Description', 240);
    const items = requiredText(form, 'items', 'Checklist', 4000).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 30);
    if (items.length < 3) return { error: 'Add at least 3 checklist lines.' };
    const compliance = checkContent([title, description, ...items]);
    if (compliance.status === 'block') return { error: 'Copy is blocked. Remove risky claims.' };
    const slug = toSlug(title);
    const { error } = await createAdminClient().from('lead_magnets').insert({
      slug, title, description, format: 'checklist', email_subject: `Your ${title.toLowerCase()}`, published: checkbox(form, 'published'),
      sections: toJson([{ heading: 'Checklist', items }]),
    });
    if (error) return { error: error.code === '23505' ? 'A checklist with that name exists.' : 'Couldn’t save.' };
    refresh();
    return { notice: 'Checklist saved.' };
  });
}

export async function setMagnetPublished(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'magnet_id', 'Checklist');
    const published = checkbox(form, 'published');
    const { error } = await createAdminClient().from('lead_magnets').update({ published }).eq('id', id);
    if (error) return { error: 'Couldn’t update.' };
    refresh();
    return { notice: published ? 'Live.' : 'Hidden.' };
  });
}
