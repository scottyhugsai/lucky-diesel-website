'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type ActionState, InputError, checkbox, guard, oneOf, requiredText, requiredUuid, text } from '@/components/admin/core/parse';
import { AD_PLATFORMS, GOAL_OPTIONS, SOURCE_KINDS } from '@/components/admin/marketing/studio/labels';
import { requireRole } from '@/lib/auth';
import { decideApproval, listApprovalQueue, submitForApproval, type ApprovalSubject } from '@/lib/marketing/content/approvals-service';
import { checkContent } from '@/lib/marketing/content/compliance';
import { generateAdCreative, type SubjectInput } from '@/lib/marketing/content/creative-service';
import { adminDb, toJson } from '@/lib/marketing/content/db';
import { seasonFor } from '@/lib/marketing/content/planner';

const LOCKED = ['scheduled', 'live', 'paused', 'completed', 'archived'];

function refreshAds(creativeId?: string) {
  revalidatePath('/admin/marketing/ads');
  revalidatePath('/admin/marketing/ads/approvals');
  if (creativeId) revalidatePath(`/admin/marketing/ads/creative/${creativeId}`);
}

function subjectFrom(form: FormData, goalKey: string): SubjectInput {
  const source = oneOf(form, 'source', SOURCE_KINDS, 'source');
  const goal = GOAL_OPTIONS.find((g) => g.key === goalKey)!;
  if (source === 'auto') return { kind: 'season', season: goal.season ?? seasonFor(new Date()) ?? 'spring_tune' };
  const ref = requiredText(form, `ref_${source}`, source === 'product' ? 'Product' : source === 'build' ? 'Build' : 'Offer', 120);
  if (source === 'product') return { kind: 'product', handle: ref };
  if (source === 'build') return { kind: 'build', buildId: ref };
  return { kind: 'offer', landingSlug: ref };
}

/** Step 3 of the studio: writes variants and queues them for approval. */
export async function generateAd(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  let creativeId = '';
  const state = await guard(async () => {
    const goalKey = oneOf(form, 'goal', GOAL_OPTIONS.map((g) => g.key), 'goal');
    const platform = oneOf(form, 'platform', AD_PLATFORMS, 'platform');
    const goal = GOAL_OPTIONS.find((g) => g.key === goalKey)!;
    const result = await generateAdCreative({ goal: goal.goal, platform, subject: subjectFrom(form, goalKey), count: 4, requestedBy: viewer.userId });
    if (!result.ok) throw new InputError(result.error);
    creativeId = result.data.creativeId;
    return {};
  });
  if (state.error) return state;
  refreshAds();
  redirect(`/admin/marketing/ads/creative/${creativeId}`);
}

/** Edits one variant's words. Any edit clears the old approval and re-queues the ad. */
export async function editVariant(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const variantId = requiredUuid(form, 'variantId', 'Variant');
    const headline = requiredText(form, 'headline', 'Headline', 90);
    const primary = requiredText(form, 'primary', 'Main text', 500);
    const cta = requiredText(form, 'cta', 'Button', 20).toUpperCase().replace(/\s+/g, '_');
    const description = text(form, 'description', { max: 90, label: 'Description' });

    const db = adminDb();
    const { data: variant } = await db.from('ad_creative_variants').select('id, creative_id, long_headline, ad_creatives(status)').eq('id', variantId).maybeSingle();
    if (!variant?.ad_creatives) throw new InputError('Variant not found.');
    if (LOCKED.includes(variant.ad_creatives.status)) throw new InputError('This ad is running. Make a new one to change words.');

    const report = checkContent([headline, variant.long_headline, primary, description]);
    const { error } = await db.from('ad_creative_variants').update({
      headline, primary_text: primary, cta, description, compliance_status: report.status, compliance_issues: toJson(report.issues),
    }).eq('id', variantId);
    if (error) throw new Error(error.message);

    const creativeId = variant.creative_id;
    await db.from('ad_creatives').update({ status: 'draft' }).eq('id', creativeId);
    const { data: usable } = await db.from('ad_creative_variants').select('id').eq('creative_id', creativeId).neq('compliance_status', 'block');
    refreshAds(creativeId);
    if (!usable?.length) return { notice: 'Saved. Every variant is blocked, so nothing was queued.' };
    const queued = await submitForApproval('ad_creative', creativeId, viewer.userId, db);
    if (!queued.ok) throw new InputError(queued.error);
    return { notice: report.status === 'block' ? 'Saved, but this variant is blocked. Others were re-queued.' : 'Saved and sent for approval.' };
  });
}

function refreshFor(type: ApprovalSubject) {
  revalidatePath('/admin/marketing/ads/approvals');
  if (type === 'ad_creative') revalidatePath('/admin/marketing/ads', 'layout');
  if (type === 'ad_campaign') revalidatePath('/admin/marketing/ads/campaigns');
  if (type === 'social_post') revalidatePath('/admin/marketing/social', 'layout');
  if (type === 'seo_content') revalidatePath('/admin/marketing/content', 'layout');
}

/** Approve, reject or request changes on one queued item. */
export async function decide(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const approvalId = requiredUuid(form, 'approvalId', 'Approval');
    const decision = oneOf(form, 'decision', ['approved', 'rejected', 'changes_requested'] as const, 'decision');
    const notes = text(form, 'notes', { max: 500, label: 'Note' });
    if (decision === 'changes_requested' && !notes) throw new InputError('Say what to change.');
    const db = adminDb();
    const { data: row } = await db.from('marketing_approvals').select('subject_type').eq('id', approvalId).maybeSingle();
    const result = await decideApproval({ approvalId, decision, decidedBy: viewer.userId, notes: notes ?? undefined, acknowledgeWarnings: checkbox(form, 'ack') }, db);
    if (!result.ok) throw new InputError(result.error);
    if (row) refreshFor(row.subject_type);
    return { notice: decision === 'approved' ? 'Approved.' : decision === 'rejected' ? 'Rejected.' : 'Sent back for changes.' };
  });
}

/** Approves every queued item that is clear of compliance flags and unchanged since submission. */
export async function approveAllClear(): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const db = adminDb();
    const queue = await listApprovalQueue(db);
    const { data: flagged } = await db.from('social_posts').select('id').eq('needs_privacy_review', true);
    const privacy = new Set((flagged ?? []).map((p) => p.id));
    const clear = queue.filter((item) => item.compliance === 'pass' && !item.stale && !privacy.has(item.subjectId));
    let approved = 0;
    for (const item of clear) {
      const result = await decideApproval({ approvalId: item.id, decision: 'approved', decidedBy: viewer.userId }, db);
      if (result.ok) approved += 1;
    }
    for (const type of new Set(clear.map((c) => c.subjectType))) refreshFor(type);
    revalidatePath('/admin/marketing/ads/approvals');
    return { notice: approved ? `Approved ${approved}. Flagged items still need a look.` : 'Nothing clear to approve.' };
  });
}
