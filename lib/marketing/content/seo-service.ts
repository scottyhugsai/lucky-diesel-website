import 'server-only';
import { submitForApproval } from './approvals-service';
import { resolveConnection } from './channels/registry';
import { adminDb, buildToRef, fail, toJson, type Db, type Result } from './db';
import { auditNap, draftBuildPage, draftJobBlogPost, draftServiceFaq, LOCAL_SEO_CHECKLIST, type Nap, type SeoDraft } from './seo';

async function storeSeoDraft(db: Db, draft: SeoDraft, source: { type: 'build' | 'work_order' | 'manual'; id: string | null }, requestedBy: string | null): Promise<Result<{ seoId: string }>> {
  const { data, error } = await db.from('seo_content').upsert({
    kind: draft.kind, title: draft.title, slug: draft.slug, summary: draft.summary, body: toJson(draft.body), faq: toJson(draft.faq), meta_description: draft.metaDescription,
    source_type: source.type, source_id: source.id, status: 'draft', generator: 'demo', compliance_status: draft.compliance.status, compliance_issues: toJson(draft.compliance.issues),
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
    return await storeSeoDraft(db, draftBuildPage(buildToRef(build), build.story), { type: 'build', id: build.id }, requestedBy);
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
    const draft = draftJobBlogPost({
      title: job.title, platform: v.platform ?? 'other', vehicleLabel: [v.year, v.make, v.model].filter(Boolean).join(' '), complaint: job.complaint,
      lines: job.line_items.filter((l) => l.approval === 'approved' && l.kind !== 'fee').map((l) => l.description),
    });
    return await storeSeoDraft(db, draft, { type: 'work_order', id: workOrderId }, requestedBy);
  } catch (error) {
    return fail(error);
  }
}

export async function generateServiceFaqDraft(requestedBy: string | null = null, db: Db = adminDb()): Promise<Result<{ seoId: string }>> {
  try {
    return await storeSeoDraft(db, draftServiceFaq(), { type: 'manual', id: null }, requestedBy);
  } catch (error) {
    return fail(error);
  }
}

export interface LocalSeoStatus {
  checklist: { key: string; label: string; done: boolean }[];
  listings: { id: string; directory: string; category: string; url: string | null; status: string; napConsistent: boolean | null; mismatches: string[]; notes: string | null }[];
}

/** Listings checklist with NAP consistency and the local SEO checklist, for the admin. */
export async function getLocalSeoStatus(db: Db = adminDb()): Promise<LocalSeoStatus> {
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: listings }, { count: reviews }, { count: posts }, gbp] = await Promise.all([
    db.from('listings').select('*').order('sort'),
    db.from('reviews').select('id', { count: 'exact', head: true }).eq('source', 'google'),
    db.from('social_posts').select('id', { count: 'exact', head: true }).eq('status', 'published').gte('published_at', monthAgo),
    resolveConnection('gbp', db),
  ]);
  const facts = { hasAddress: false, hasHours: false, gbpVerified: gbp.status === 'connected', reviews: reviews ?? 0, postsLast30: posts ?? 0 };
  return {
    checklist: LOCAL_SEO_CHECKLIST.map((item) => ({ key: item.key, label: item.label, done: item.done(facts) })),
    listings: (listings ?? []).map((l) => {
      const nap = (l.nap ?? {}) as Partial<Nap>;
      const audit = l.status === 'not_started' || l.status === 'not_applicable' ? null : auditNap(nap);
      return { id: l.id, directory: l.directory, category: l.category, url: l.url, status: l.status, napConsistent: audit?.consistent ?? l.nap_consistent, mismatches: audit?.mismatches ?? [], notes: l.notes };
    }),
  };
}
