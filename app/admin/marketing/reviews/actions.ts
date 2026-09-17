'use server';

import { revalidatePath } from 'next/cache';
import { guard, number, oneOf, requiredText, requiredUuid, text, checkbox, type ActionState } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { decideApproval, submitForApproval } from '@/lib/marketing/content/approvals-service';
import { checkReplyText } from '@/lib/marketing/content/reputation';
import { createReviewSocialPost, decideVideoTestimonial, requestVideoTestimonial } from '@/lib/marketing/content/reputation-ops';
import { draftReplyForReview, ingestReview, postReviewReply } from '@/lib/marketing/content/reputation-service';
import { toJson } from '@/lib/marketing/content/db';
import { createAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/marketing/reviews';

export async function draftReply(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const reviewId = requiredUuid(form, 'review_id', 'Review');
    const result = await draftReplyForReview(reviewId, viewer.userId);
    if (!result.ok) return { error: result.error };
    revalidatePath(PATH);
    return { notice: 'Draft ready. Edit, then post.' };
  });
}

/** Saves the edited text, re-checks it, approves it and posts it (simulated when Google isn't connected). */
export async function approveAndPost(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const replyId = requiredUuid(form, 'reply_id', 'Reply');
    const body = requiredText(form, 'text', 'Reply', 600);
    const db = createAdminClient();
    const { data: reply } = await db.from('review_replies').select('id, draft_text, final_text, status').eq('id', replyId).maybeSingle();
    if (!reply) return { error: 'Reply not found.' };
    if (reply.status === 'posted' || reply.status === 'simulated') return { error: 'Already posted.' };

    const compliance = checkReplyText(body);
    if (compliance.status === 'block') return { error: `Can’t post: ${compliance.issues.filter((i) => i.severity === 'block').map((i) => i.reason).join(' ')}` };
    const acknowledged = checkbox(form, 'ack');
    if (compliance.status === 'warn' && !acknowledged) return { error: `Check the warning, then tick “I checked it”: ${compliance.issues.map((i) => i.reason).join(' ')}` };

    const current = reply.final_text ?? reply.draft_text;
    if (body !== current || reply.status !== 'pending_approval') {
      const { error } = await db.from('review_replies').update({ final_text: body, status: 'draft', compliance_status: compliance.status, compliance_issues: toJson(compliance.issues) }).eq('id', replyId);
      if (error) return { error: 'Couldn’t save the reply.' };
      const queued = await submitForApproval('review_reply', replyId, viewer.userId);
      if (!queued.ok) return { error: queued.error };
    }
    const { data: approval } = await db.from('marketing_approvals').select('id').eq('subject_type', 'review_reply').eq('subject_id', replyId).eq('decision', 'pending').order('requested_at', { ascending: false }).limit(1).maybeSingle();
    if (!approval) return { error: 'Nothing waiting for approval.' };
    const decided = await decideApproval({ approvalId: approval.id, decision: 'approved', decidedBy: viewer.userId, acknowledgeWarnings: acknowledged });
    if (!decided.ok) return { error: decided.error };
    const posted = await postReviewReply(replyId);
    if (!posted.ok) return { error: posted.error };
    revalidatePath(PATH);
    return { notice: posted.data.status === 'posted' ? 'Reply posted to Google.' : 'Reply saved (demo: not sent to Google).' };
  });
}

export async function addReview(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const source = oneOf(form, 'source', ['manual', 'facebook', 'internal'] as const, 'source');
    const rating = number(form, 'rating', { min: 1, max: 5, integer: true, required: true, label: 'Rating' }) as number;
    const authorName = requiredText(form, 'author', 'Name', 120);
    const body = text(form, 'body', { max: 4000, label: 'Review' });
    const date = text(form, 'date', { max: 10, label: 'Date' });
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Pick a valid date.' };
    const result = await ingestReview({ source, rating, authorName, body, reviewedAt: date ? new Date(`${date}T12:00:00Z`).toISOString() : undefined });
    if (!result.ok) return { error: result.error };
    revalidatePath(PATH);
    return { notice: result.data.alerted ? 'Saved. Owner alerted.' : 'Review saved.' };
  });
}

/** Turns an approved review into a social post draft (never auto-published). */
export async function draftReviewPost(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const id = requiredText(form, 'review_id', 'Review', 40);
    const result = await createReviewSocialPost(id, viewer.userId);
    if (!result.ok) return { error: result.error };
    revalidatePath('/admin/marketing/reviews');
    revalidatePath('/admin/marketing/social');
    return { notice: result.data.created ? 'Draft ready in Social.' : 'A draft already exists in Social.' };
  });
}

/** Asks a customer for a short video. They get a one-time upload link with the release. */
export async function askForVideoTestimonial(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const customerId = requiredText(form, 'customer_id', 'Customer', 40);
    const result = await requestVideoTestimonial(customerId, viewer.userId);
    if (!result.ok) return { error: result.error };
    revalidatePath('/admin/marketing/reviews');
    return { notice: 'Link sent. It expires in 30 days.' };
  });
}

/** Approves or rejects an uploaded video. Approval is required before any use. */
export async function decideTestimonial(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredText(form, 'id', 'Video', 40);
    const decision = form.get('decision') === 'approve' ? 'approved' : 'rejected';
    const result = await decideVideoTestimonial(id, decision);
    if (!result.ok) return { error: result.error };
    revalidatePath('/admin/marketing/reviews');
    return { notice: decision === 'approved' ? 'Approved.' : 'Rejected.' };
  });
}
