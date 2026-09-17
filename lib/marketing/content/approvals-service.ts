import 'server-only';
import type { Tables } from '@/lib/db/database.types';
import { decide, payloadHash, transition, type ApprovalRecord, type ContentStatus } from './approvals';
import { adminDb, fail, type Db, type Result } from './db';
import type { ComplianceStatus } from './types';

export type ApprovalSubject = Tables<'marketing_approvals'>['subject_type'];

export interface SubjectSnapshot {
  status: ContentStatus;
  payload: unknown;
  compliance: ComplianceStatus;
  title: string;
}

function worst(statuses: readonly ComplianceStatus[]): ComplianceStatus {
  return statuses.includes('block') ? 'block' : statuses.includes('warn') ? 'warn' : 'pass';
}

/** The exact content an approval covers. Any edit to these fields changes the hash. */
export async function loadSubject(db: Db, type: ApprovalSubject, id: string): Promise<SubjectSnapshot | null> {
  switch (type) {
    case 'ad_creative': {
      const { data } = await db.from('ad_creatives').select('*, ad_creative_variants(*)').eq('id', id).maybeSingle();
      if (!data) return null;
      const variants = [...data.ad_creative_variants].sort((a, b) => a.label.localeCompare(b.label));
      const usable = variants.filter((v) => v.compliance_status !== 'block');
      return {
        status: data.status as ContentStatus,
        title: data.name,
        compliance: usable.length ? worst(usable.map((v) => v.compliance_status as ComplianceStatus)) : 'block',
        payload: {
          platform: data.platform, landing_url: data.landing_url,
          variants: usable.map((v) => ({ id: v.id, headline: v.headline, long_headline: v.long_headline, primary_text: v.primary_text, description: v.description, cta: v.cta, format: v.format, image_template: v.image_template, image_params: v.image_params })),
        },
      };
    }
    case 'ad_campaign': {
      const { data } = await db.from('ad_campaigns').select('*').eq('id', id).maybeSingle();
      if (!data) return null;
      return {
        status: data.status as ContentStatus, title: data.name, compliance: 'pass',
        payload: { platform: data.platform, objective: data.objective, audience: data.audience, daily_budget_cents: data.daily_budget_cents, starts_on: data.starts_on, ends_on: data.ends_on, landing_page_id: data.landing_page_id },
      };
    }
    case 'social_post': {
      const { data } = await db.from('social_posts').select('*, social_post_targets(platform, caption_override, platform_options)').eq('id', id).maybeSingle();
      if (!data) return null;
      return {
        status: data.status as ContentStatus, title: data.title, compliance: data.compliance_status as ComplianceStatus,
        payload: { caption: data.caption, hashtags: data.hashtags, link_url: data.link_url, asset_ids: data.asset_ids, image_template: data.image_template, image_params: data.image_params, scheduled_for: data.scheduled_for, targets: [...data.social_post_targets].sort((a, b) => a.platform.localeCompare(b.platform)) },
      };
    }
    case 'review_reply': {
      const { data } = await db.from('review_replies').select('*').eq('id', id).maybeSingle();
      if (!data) return null;
      return { status: data.status as ContentStatus, title: 'Review reply', compliance: data.compliance_status as ComplianceStatus, payload: { review_id: data.review_id, text: data.final_text ?? data.draft_text } };
    }
    case 'landing_page': {
      const { data } = await db.from('landing_pages').select('*').eq('id', id).maybeSingle();
      if (!data) return null;
      const { data: pending } = await db.from('marketing_approvals').select('decision').eq('subject_type', type).eq('subject_id', id).order('requested_at', { ascending: false }).limit(1).maybeSingle();
      const status: ContentStatus = data.published ? 'published' : pending?.decision === 'pending' ? 'pending_approval' : pending?.decision === 'approved' ? 'approved' : 'draft';
      return { status, title: data.title, compliance: 'pass', payload: { slug: data.slug, title: data.title, blocks: data.blocks, offer: data.offer, form: data.form } };
    }
    case 'seo_content': {
      const { data } = await db.from('seo_content').select('*').eq('id', id).maybeSingle();
      if (!data) return null;
      return { status: data.status as ContentStatus, title: data.title, compliance: data.compliance_status as ComplianceStatus, payload: { title: data.title, slug: data.slug, summary: data.summary, body: data.body, faq: data.faq, meta_description: data.meta_description } };
    }
    default:
      return null;
  }
}

async function setSubjectStatus(db: Db, type: ApprovalSubject, id: string, status: ContentStatus): Promise<string | null> {
  const now = new Date().toISOString();
  const run = async (): Promise<{ error: { message: string } | null }> => {
    switch (type) {
      case 'ad_creative': return db.from('ad_creatives').update({ status }).eq('id', id);
      case 'ad_campaign': return db.from('ad_campaigns').update({ status }).eq('id', id);
      case 'social_post': return db.from('social_posts').update({ status }).eq('id', id);
      case 'review_reply': return db.from('review_replies').update({ status }).eq('id', id);
      case 'seo_content': return db.from('seo_content').update({ status }).eq('id', id);
      case 'landing_page':
        // Approving a landing page is what publishes it.
        return status === 'approved' ? db.from('landing_pages').update({ published: true, published_at: now }).eq('id', id) : { error: null };
      default:
        return { error: { message: `Unknown approval subject ${type}` } };
    }
  };
  const { error } = await run();
  return error?.message ?? null;
}

/** Moves a draft into the approval queue with a hash of its current content. */
export async function submitForApproval(type: ApprovalSubject, id: string, requestedBy: string | null, db: Db = adminDb()): Promise<Result<{ approvalId: string }>> {
  try {
    const subject = await loadSubject(db, type, id);
    if (!subject) return { ok: false, error: 'Not found.' };
    if (subject.status !== 'pending_approval') transition(subject.status, 'pending_approval');
    await db.from('marketing_approvals').update({ decision: 'changes_requested', notes: 'superseded by a newer submission', decided_at: new Date().toISOString() }).eq('subject_type', type).eq('subject_id', id).eq('decision', 'pending');
    const { data, error } = await db
      .from('marketing_approvals')
      .insert({ subject_type: type, subject_id: id, payload_hash: payloadHash(subject.payload), requested_by: requestedBy })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? 'Could not queue approval.' };
    const statusError = await setSubjectStatus(db, type, id, 'pending_approval');
    if (statusError) return { ok: false, error: statusError };
    return { ok: true, data: { approvalId: data.id } };
  } catch (error) {
    return fail(error);
  }
}

export interface DecisionInput {
  approvalId: string;
  decision: 'approved' | 'rejected' | 'changes_requested';
  decidedBy: string;
  notes?: string;
  acknowledgeWarnings?: boolean;
}

/** Records the owner's decision. Refuses stale approvals (content edited since submission) and blocked content. */
export async function decideApproval(input: DecisionInput, db: Db = adminDb()): Promise<Result<{ status: ContentStatus }>> {
  try {
    const { data: approval } = await db.from('marketing_approvals').select('*').eq('id', input.approvalId).maybeSingle();
    if (!approval) return { ok: false, error: 'Approval not found.' };
    if (approval.decision !== 'pending') return { ok: false, error: 'This approval was already decided.' };
    const subject = await loadSubject(db, approval.subject_type, approval.subject_id);
    if (!subject) return { ok: false, error: 'The content no longer exists.' };
    if (input.decision === 'approved' && payloadHash(subject.payload) !== approval.payload_hash) {
      return { ok: false, error: 'The content changed after it was submitted. Submit it again.' };
    }
    if (input.decision === 'approved' && subject.compliance === 'warn' && !input.acknowledgeWarnings) {
      return { ok: false, error: 'Confirm you checked the compliance warnings before approving.' };
    }
    const status = decide('pending_approval', input.decision, subject.compliance);
    const { error } = await db
      .from('marketing_approvals')
      .update({ decision: input.decision, decided_by: input.decidedBy, decided_at: new Date().toISOString(), notes: input.notes ?? null, warnings_acknowledged: Boolean(input.acknowledgeWarnings) })
      .eq('id', approval.id)
      .eq('decision', 'pending');
    if (error) return { ok: false, error: error.message };
    const statusError = await setSubjectStatus(db, approval.subject_type, approval.subject_id, status);
    if (statusError) return { ok: false, error: statusError };
    return { ok: true, data: { status } };
  } catch (error) {
    return fail(error);
  }
}

/** Latest decided approval for a subject, in the shape `canPublish` expects. */
export async function latestApproval(db: Db, type: ApprovalSubject, id: string): Promise<(ApprovalRecord & { id: string; warningsAcknowledged: boolean }) | null> {
  const { data } = await db.from('marketing_approvals').select('*').eq('subject_type', type).eq('subject_id', id).eq('decision', 'approved').order('decided_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return { id: data.id, decision: 'approved', payloadHash: data.payload_hash, decidedBy: data.decided_by, decidedAt: data.decided_at, warningsAcknowledged: data.warnings_acknowledged };
}

/** Everything waiting on the owner, oldest first, with a title for the queue. */
export async function listApprovalQueue(db: Db = adminDb()): Promise<{ id: string; subjectType: ApprovalSubject; subjectId: string; title: string; compliance: ComplianceStatus; requestedAt: string; stale: boolean }[]> {
  const { data } = await db.from('marketing_approvals').select('*').eq('decision', 'pending').order('requested_at').limit(100);
  const rows = await Promise.all((data ?? []).map(async (a) => {
    const subject = await loadSubject(db, a.subject_type, a.subject_id);
    if (!subject) return null;
    return { id: a.id, subjectType: a.subject_type, subjectId: a.subject_id, title: subject.title, compliance: subject.compliance, requestedAt: a.requested_at, stale: payloadHash(subject.payload) !== a.payload_hash };
  }));
  return rows.filter((r): r is NonNullable<typeof r> => r !== null);
}
