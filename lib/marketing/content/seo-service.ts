import 'server-only';
import { writeCopy } from './ai';
import { submitForApproval } from './approvals-service';
import { resolveConnection } from './channels/registry';
import { adminDb, buildToRef, fail, loadVoice, recordGeneration, toJson, type Db, type Result } from './db';
import {
  auditNap, draftAreaPage, draftBuildPage, draftJobBlogPost, draftServiceFaq, draftText, draftTopicBlogPost, faqToText, finish,
  LOCAL_SEO_CHECKLIST, parseFaq, parseSections, sectionsToText, type FaqItem, type Nap, type SeoDraft, type SeoSection,
} from './seo';
import { checkScaledContent, type GuardKind, type GuardResult } from './seo-guard';
import { findArea, taskIsDue } from './seo-local';
import type { PlatformId } from './types';

type Source = { type: 'build' | 'work_order' | 'manual'; id: string | null };
type Generator = 'demo' | 'ai';

const AI_MAX_CHARS = 4000;

/**
 * Routes a draft through the AI writer when it is connected (MARKETING_AI_MODE=live).
 * The demo template is the fallback and is used as-is when AI is off or returns junk.
 */
async function writeWithAi(db: Db, demo: SeoDraft, task: string, facts: Record<string, unknown>, requestedBy: string | null): Promise<{ draft: SeoDraft; generator: Generator }> {
  const fallback = [sectionsToText(demo.body), demo.faq.length ? `## FAQ\n${faqToText(demo.faq)}` : ''].filter(Boolean).join('\n\n');
  const { text, meta } = await writeCopy({
    task: `${task}\nFormat: sections that each start with "## Heading". End with "## FAQ" and 2-4 "Q:" lines, each followed by an "A:" line. No customer names, prices, distances, reviews or stats that are not in the facts.`,
    facts, maxChars: AI_MAX_CHARS, voice: await loadVoice(db), fallback,
  });
  await recordGeneration(db, { kind: 'seo', input: { task, facts }, output: { text }, meta, requestedBy });
  if (meta.generator !== 'ai') return { draft: demo, generator: 'demo' };

  const sections = parseSections(text);
  const faqSection = sections.find((s) => /^faq/i.test(s.heading));
  const body = sections.filter((s) => s !== faqSection);
  if (body.length < 2) return { draft: demo, generator: 'demo' };
  const faq = faqSection ? parseFaq(faqSection.text) : [];
  return {
    draft: finish({ kind: demo.kind, title: demo.title, slug: demo.slug, summary: demo.summary, metaDescription: demo.metaDescription, area: demo.area, platform: demo.platform, body, faq: faq.length ? faq : demo.faq }),
    generator: 'ai',
  };
}

async function storeSeoDraft(db: Db, draft: SeoDraft, source: Source, generator: Generator, requestedBy: string | null): Promise<Result<{ seoId: string }>> {
  const { data: existing } = await db.from('seo_content').select('status').eq('kind', draft.kind).eq('slug', draft.slug).maybeSingle();
  if (existing?.status === 'published') return { ok: false, error: 'That page is already live. Edit the published page instead.' };
  const { data, error } = await db.from('seo_content').upsert({
    kind: draft.kind, title: draft.title, slug: draft.slug, summary: draft.summary, body: toJson(draft.body), faq: toJson(draft.faq), meta_description: draft.metaDescription,
    area: draft.area ?? null, platform: draft.platform ?? null,
    source_type: source.type, source_id: source.id, status: 'draft', generator, compliance_status: draft.compliance.status, compliance_issues: toJson(draft.compliance.issues),
  }, { onConflict: 'kind,slug' }).select('id').single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not save the draft.' };
  if (draft.compliance.status !== 'block') {
    const queued = await submitForApproval('seo_content', data.id, requestedBy, db);
    if (!queued.ok) return queued;
  }
  return { ok: true, data: { seoId: data.id } };
}

/** Build page draft from a published build and its real dyno numbers. */
export async function generateBuildPageDraft(buildId: string, requestedBy: string | null = null, db: Db = adminDb()): Promise<Result<{ seoId: string }>> {
  try {
    const { data: build } = await db.from('builds').select('*').eq('id', buildId).maybeSingle();
    if (!build) return { ok: false, error: 'Build not found.' };
    const demo = draftBuildPage(buildToRef(build), build.story);
    const facts = { title: build.title, vehicle: build.vehicle_label, platform: build.platform, parts: build.parts, beforeHp: build.before_hp, afterHp: build.after_hp, beforeTorque: build.before_torque, afterTorque: build.after_torque, story: build.story, city: 'Charleston, SC' };
    const { draft, generator } = await writeWithAi(db, demo, 'Write a build page for this customer truck: the goal, the work, the dyno numbers (say results vary) and a call to request a quote.', facts, requestedBy);
    return await storeSeoDraft(db, draft, { type: 'build', id: build.id }, generator, requestedBy);
  } catch (error) {
    return fail(error);
  }
}

/** Blog draft from a completed job. Customer names and contact details never enter the draft. */
export async function generateJobBlogDraft(workOrderId: string, requestedBy: string | null = null, db: Db = adminDb()): Promise<Result<{ seoId: string }>> {
  try {
    const { data: job } = await db.from('work_orders').select('title, complaint, status, vehicles(year, make, model, platform), line_items(description, kind, approval)').eq('id', workOrderId).maybeSingle();
    if (!job?.vehicles) return { ok: false, error: 'Job not found.' };
    if (!['ready', 'invoiced', 'paid'].includes(job.status)) return { ok: false, error: 'Only finished jobs become blog drafts.' };
    const v = job.vehicles;
    const demo = draftJobBlogPost({
      title: job.title, platform: v.platform ?? 'other', vehicleLabel: [v.year, v.make, v.model].filter(Boolean).join(' '), complaint: job.complaint,
      lines: job.line_items.filter((l) => l.approval === 'approved' && l.kind !== 'fee').map((l) => l.description),
    });
    // Facts come from the scrubbed demo draft, so phone numbers are already removed.
    const facts = { job: job.title, vehicle: [v.year, v.make, v.model].filter(Boolean).join(' '), symptom: demo.body[0]?.text, work: demo.body[1]?.text, city: 'Charleston, SC' };
    const { draft, generator } = await writeWithAi(db, demo, 'Write a helpful blog post about this repair: symptom, diagnosis, the fix and how owners can avoid it.', facts, requestedBy);
    return await storeSeoDraft(db, draft, { type: 'work_order', id: workOrderId }, generator, requestedBy);
  } catch (error) {
    return fail(error);
  }
}

/** Blog draft from a topic the owner picks. */
export async function generateTopicBlogDraft(topic: string, platform: PlatformId | null, requestedBy: string | null = null, db: Db = adminDb()): Promise<Result<{ seoId: string }>> {
  try {
    const demo = draftTopicBlogPost(topic, platform);
    const { draft, generator } = await writeWithAi(db, demo, `Write a blog post answering: "${demo.title}". Practical, for truck owners.`, { topic: demo.title, platform, city: 'Charleston, SC' }, requestedBy);
    return await storeSeoDraft(db, draft, { type: 'manual', id: null }, generator, requestedBy);
  } catch (error) {
    return fail(error);
  }
}

export async function generateServiceFaqDraft(requestedBy: string | null = null, db: Db = adminDb()): Promise<Result<{ seoId: string }>> {
  try {
    return await storeSeoDraft(db, draftServiceFaq(), { type: 'manual', id: null }, 'demo', requestedBy);
  } catch (error) {
    return fail(error);
  }
}

/** Service-area page draft for one town in BUSINESS.areaServed. */
export async function generateAreaPageDraft(areaSlug: string, requestedBy: string | null = null, db: Db = adminDb()): Promise<Result<{ seoId: string }>> {
  try {
    const area = findArea(areaSlug);
    if (!area) return { ok: false, error: 'Pick a town we serve.' };
    // AI output for towns is generic by nature; keep the template so the owner adds real local detail.
    return await storeSeoDraft(db, draftAreaPage(area), { type: 'manual', id: null }, 'demo', requestedBy);
  } catch (error) {
    return fail(error);
  }
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Scaled-content guard for one draft against live and queued pages of the same kind. */
export async function checkSeoGuard(id: string, db: Db = adminDb()): Promise<GuardResult | null> {
  const { data: row } = await db.from('seo_content').select('id, kind, title, summary, body, faq').eq('id', id).maybeSingle();
  if (!row) return null;
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: others }, { count }] = await Promise.all([
    db.from('seo_content').select('title, summary, body, faq').eq('kind', row.kind).neq('id', id).in('status', ['pending_approval', 'approved', 'published']).limit(200),
    db.from('seo_content').select('id', { count: 'exact', head: true }).in('kind', ['blog_post', 'area_page']).eq('status', 'published').gte('published_at', monthAgo),
  ]);
  const text = (r: { title: string; summary: string; body: unknown; faq: unknown }) => draftText({ title: r.title, summary: r.summary, body: list<SeoSection>(r.body), faq: list<FaqItem>(r.faq) });
  return checkScaledContent({
    kind: row.kind as GuardKind,
    text: text(row),
    faqCount: list<FaqItem>(row.faq).length,
    others: (others ?? []).map((o) => ({ title: o.title, text: text(o) })),
    publishedLast30: count ?? 0,
  });
}

export interface LocalSeoStatus {
  checklist: { key: string; label: string; done: boolean }[];
  listings: { id: string; directory: string; category: string; url: string | null; status: string; napConsistent: boolean | null; mismatches: string[]; notes: string | null }[];
  tasks: { id: string; category: 'pr' | 'brand'; title: string; hint: string | null; url: string | null; status: string; due: boolean; notes: string | null; doneAt: string | null }[];
  closures: { id: string; label: string; message: string | null; startsOn: string; endsOn: string; closed: boolean }[];
}

/** Listings checklist with NAP consistency, the local SEO checklist, PR/brand tasks and closures, for the admin. */
export async function getLocalSeoStatus(db: Db = adminDb()): Promise<LocalSeoStatus> {
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: listings }, { count: reviews }, { count: posts }, gbp, { data: tasks }, { data: closures }] = await Promise.all([
    db.from('listings').select('*').order('sort'),
    db.from('reviews').select('id', { count: 'exact', head: true }).eq('source', 'google'),
    db.from('social_posts').select('id', { count: 'exact', head: true }).eq('status', 'published').gte('published_at', monthAgo),
    resolveConnection('gbp', db),
    db.from('seo_tasks').select('*').order('sort'),
    db.from('shop_closures').select('*').gte('ends_on', today).order('starts_on').limit(20),
  ]);
  const facts = { hasAddress: false, hasHours: false, gbpVerified: gbp.status === 'connected', reviews: reviews ?? 0, postsLast30: posts ?? 0 };
  return {
    checklist: LOCAL_SEO_CHECKLIST.map((item) => ({ key: item.key, label: item.label, done: item.done(facts) })),
    listings: (listings ?? []).map((l) => {
      const nap = (l.nap ?? {}) as Partial<Nap>;
      const audit = l.status === 'not_started' || l.status === 'not_applicable' ? null : auditNap(nap);
      return { id: l.id, directory: l.directory, category: l.category, url: l.url, status: l.status, napConsistent: audit?.consistent ?? l.nap_consistent, mismatches: audit?.mismatches ?? [], notes: l.notes };
    }),
    tasks: (tasks ?? []).map((t) => ({
      id: t.id, category: t.category as 'pr' | 'brand', title: t.title, hint: t.hint, url: t.url, status: t.status, notes: t.notes, doneAt: t.done_at,
      due: taskIsDue({ status: t.status, repeatDays: t.repeat_days, doneAt: t.done_at }),
    })),
    closures: (closures ?? []).map((c) => ({ id: c.id, label: c.label, message: c.message, startsOn: c.starts_on, endsOn: c.ends_on, closed: c.closed })),
  };
}
