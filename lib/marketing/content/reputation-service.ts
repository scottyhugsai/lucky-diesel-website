import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { firstName as firstNameOf } from '@/lib/format';
import { siteUrl } from '@/lib/site-url';
import { writeCopy } from './ai';
import { sendContentMessage, sendContentMessageToOwners } from './alerts';
import { canPublish } from './approvals';
import { latestApproval, loadSubject, submitForApproval } from './approvals-service';
import { resolveConnection } from './channels/registry';
import { adminDb, fail, loadVoice, recordGeneration, toJson, type Db, type Result } from './db';
import { PUBLIC_REVIEW_SOURCES, buildReviewWidget, firstName, checkReplyText, draftReviewReply, isNegative, npsFollowUp, type ReviewWidget } from './reputation';

export interface ReviewInput {
  source: 'google' | 'facebook' | 'manual' | 'internal';
  externalId?: string | null;
  rating: number;
  body: string | null;
  authorName: string;
  reviewedAt?: string;
  customerId?: string | null;
}

/** Drafts a reply (AI when live, demo otherwise) and queues it for approval. */
export async function draftReplyForReview(reviewId: string, requestedBy: string | null = null, db: Db = adminDb()): Promise<Result<{ replyId: string }>> {
  try {
    const { data: review } = await db.from('reviews').select('*').eq('id', reviewId).maybeSingle();
    if (!review) return { ok: false, error: 'Review not found.' };
    const demo = draftReviewReply({ id: review.id, rating: review.rating, authorName: review.author_name });
    const { text, meta } = await writeCopy({
      task: `Write the owner's public reply to a ${review.rating}-star ${review.source} review. Rules: thank by first name only; no job, vehicle or price details; never offer anything; if negative apologise once and invite a call to (843) 995-9252.`,
      facts: { rating: review.rating, firstName: firstName(review.author_name), review: review.body }, maxChars: 350, voice: await loadVoice(db), fallback: demo.text,
    });
    const compliance = checkReplyText(text);
    const jobId = await recordGeneration(db, { kind: 'review_reply', input: { reviewId }, output: { text, compliance }, meta, requestedBy });
    const { data: reply, error } = await db.from('review_replies').insert({
      review_id: review.id, draft_text: text, generator: meta.generator, ai_generation_id: jobId, status: 'draft',
      compliance_status: compliance.status, compliance_issues: toJson(compliance.issues),
    }).select('id').single();
    if (error || !reply) return { ok: false, error: error?.message ?? 'Could not save the reply.' };
    if (compliance.status !== 'block') {
      const queued = await submitForApproval('review_reply', reply.id, requestedBy, db);
      if (!queued.ok) return queued;
    }
    return { ok: true, data: { replyId: reply.id } };
  } catch (error) {
    return fail(error);
  }
}

/** Stores a review (manual entry or a platform sync), drafts a reply and alerts the owner on 1–3 stars. */
export async function ingestReview(input: ReviewInput, db: Db = adminDb()): Promise<Result<{ reviewId: string; alerted: boolean; isNew: boolean }>> {
  try {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return { ok: false, error: 'Rating must be 1–5.' };
    if (!input.authorName.trim()) return { ok: false, error: 'Author is required.' };
    const externalId = input.externalId ?? `manual-${randomBytes(8).toString('hex')}`;
    const { data: existing } = await db.from('reviews').select('id, owner_alerted_at').eq('source', input.source).eq('external_id', externalId).maybeSingle();
    const { data: review, error } = await db.from('reviews').upsert({
      source: input.source, external_id: externalId, rating: input.rating, body: input.body?.trim().slice(0, 4000) ?? null, author_name: input.authorName.trim().slice(0, 120),
      reviewed_at: input.reviewedAt ?? new Date().toISOString(), customer_id: input.customerId ?? null,
    }, { onConflict: 'source,external_id' }).select('*').single();
    if (error || !review) return { ok: false, error: error?.message ?? 'Could not save the review.' };

    if (!existing && input.source !== 'internal') await draftReplyForReview(review.id, null, db);
    let alerted = false;
    if (isNegative(review.rating) && !existing?.owner_alerted_at) {
      const outcome = await sendContentMessageToOwners(db, 'content_review_negative_alert', {
        rating: review.rating, author: review.author_name, source: review.source, review_text: (review.body ?? '').slice(0, 280), admin_link: `${siteUrl()}/admin`,
      });
      alerted = outcome.sent > 0;
      await db.from('reviews').update({ owner_alerted_at: new Date().toISOString() }).eq('id', review.id);
    }
    return { ok: true, data: { reviewId: review.id, alerted, isNew: !existing } };
  } catch (error) {
    return fail(error);
  }
}

const GBP_STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/** Pulls Google reviews when the GBP connection is live. Demo mode: nothing to pull (enter reviews manually). */
export async function syncGbpReviews(db: Db = adminDb()): Promise<Result<{ imported: number; mode: 'demo' | 'live' }>> {
  try {
    const connection = await resolveConnection('gbp', db);
    if (connection.mode === 'demo' || !connection.credentials?.externalAccountId) return { ok: true, data: { imported: 0, mode: 'demo' } };
    const response = await fetch(`https://mybusiness.googleapis.com/v4/${connection.credentials.externalAccountId}/reviews?pageSize=50`, {
      headers: { Authorization: `Bearer ${connection.credentials.accessToken}` }, signal: AbortSignal.timeout(15_000),
    });
    const data = (await response.json().catch(() => ({}))) as { reviews?: { reviewId: string; starRating: string; comment?: string; reviewer?: { displayName?: string }; createTime: string; reviewReply?: unknown }[]; error?: { message?: string } };
    if (!response.ok) return { ok: false, error: `GBP: ${data.error?.message ?? response.status}` };
    let imported = 0;
    for (const r of data.reviews ?? []) {
      const saved = await ingestReview({ source: 'google', externalId: r.reviewId, rating: GBP_STARS[r.starRating] ?? 5, body: r.comment ?? null, authorName: r.reviewer?.displayName ?? 'Google user', reviewedAt: r.createTime }, db);
      if (saved.ok && saved.data.isNew) imported += 1;
      if (saved.ok && r.reviewReply) await db.from('reviews').update({ replied: true }).eq('id', saved.data.reviewId);
    }
    return { ok: true, data: { imported, mode: 'live' } };
  } catch (error) {
    return fail(error);
  }
}

/** Posts an approved reply to Google (live), or records it as simulated/manual. */
export async function postReviewReply(replyId: string, db: Db = adminDb()): Promise<Result<{ status: string }>> {
  try {
    const snapshot = await loadSubject(db, 'review_reply', replyId);
    const approval = await latestApproval(db, 'review_reply', replyId);
    if (!snapshot) return { ok: false, error: 'Reply not found.' };
    const gate = canPublish({ status: snapshot.status, approval, payload: snapshot.payload, compliance: snapshot.compliance, warningsAcknowledged: approval?.warningsAcknowledged ?? false });
    if (!gate.ok) return { ok: false, error: gate.reason };
    const { data: reply } = await db.from('review_replies').select('*, reviews(*)').eq('id', replyId).single();
    if (!reply?.reviews) return { ok: false, error: 'Review not found.' };
    const text = reply.final_text ?? reply.draft_text;

    let status: 'posted' | 'simulated' = 'simulated';
    if (reply.reviews.source === 'google' && reply.reviews.external_id) {
      const connection = await resolveConnection('gbp', db);
      if (connection.mode === 'live' && connection.credentials?.externalAccountId) {
        const response = await fetch(`https://mybusiness.googleapis.com/v4/${connection.credentials.externalAccountId}/reviews/${reply.reviews.external_id}/reply`, {
          method: 'PUT', headers: { Authorization: `Bearer ${connection.credentials.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ comment: text }), signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          const message = `GBP reply failed: HTTP ${response.status}`;
          await db.from('review_replies').update({ error: message }).eq('id', replyId);
          return { ok: false, error: message };
        }
        status = 'posted';
      }
    }
    await db.from('review_replies').update({ status, posted_at: new Date().toISOString(), error: null }).eq('id', replyId);
    await db.from('reviews').update({ replied: true }).eq('id', reply.review_id);
    return { ok: true, data: { status } };
  } catch (error) {
    return fail(error);
  }
}

/** Public widget data: real reviews only (never 'sample' or 'internal'). */
export async function getReviewWidget(limit = 6, db: Db = adminDb()): Promise<ReviewWidget> {
  const { data } = await db.from('reviews').select('id, source, rating, body, author_name, reviewed_at').in('source', [...PUBLIC_REVIEW_SOURCES]).order('reviewed_at', { ascending: false }).limit(200);
  return buildReviewWidget(data ?? [], limit);
}

const NPS_DELAY_DAYS = 3;
const NPS_WINDOW_DAYS = 10;

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Cron: survey every customer whose invoice was paid 3–10 days ago. The review link goes to all of them. */
export async function requestNpsSurveys(now = new Date(), db: Db = adminDb()): Promise<{ sent: number; skipped: number }> {
  const from = new Date(now.getTime() - NPS_WINDOW_DAYS * 86_400_000).toISOString();
  const to = new Date(now.getTime() - NPS_DELAY_DAYS * 86_400_000).toISOString();
  const { data: invoices } = await db.from('invoices').select('id, customer_id, paid_at, customers(*), nps_responses(id)').eq('status', 'paid').gte('paid_at', from).lte('paid_at', to).limit(50);
  const { data: settings } = await db.from('shop_settings').select('google_review_url').eq('id', 1).maybeSingle();
  let sent = 0;
  let skipped = 0;
  for (const invoice of invoices ?? []) {
    if (invoice.nps_responses || !invoice.customers) continue;
    const token = randomBytes(24).toString('base64url');
    const { error } = await db.from('nps_responses').insert({ invoice_id: invoice.id, customer_id: invoice.customer_id, token_hash: tokenHash(token) });
    if (error) {
      skipped += 1;
      continue;
    }
    const customer = invoice.customers;
    const outcome = await sendContentMessage(db, 'content_nps_survey', { email: customer.email, phone: customer.phone, customerId: customer.id, isCustomer: true }, {
      first_name: firstNameOf(customer.full_name), vehicle: 'truck', nps_link: `${siteUrl()}/api/marketing/content/nps?t=${token}`, review_link: settings?.google_review_url || `${siteUrl()}/review`,
    });
    if (outcome.sent) sent += 1;
    else skipped += 1;
  }
  return { sent, skipped };
}

/** Records a survey answer. Low scores alert the owner; the caller always shows the review link. */
export async function recordNpsResponse(token: string, score: number, comment: string | null, db: Db = adminDb()): Promise<Result<{ reviewLink: string; alertOwner: boolean }>> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token) || !Number.isInteger(score) || score < 0 || score > 10) return { ok: false, error: 'Invalid survey link or score.' };
  const { data: row } = await db.from('nps_responses').select('*, customers(*)').eq('token_hash', tokenHash(token)).maybeSingle();
  if (!row) return { ok: false, error: 'This survey link has expired.' };
  const clean = comment?.trim().slice(0, 1000) || null;
  await db.from('nps_responses').update({ score, comment: clean, responded_at: new Date().toISOString() }).eq('id', row.id);
  const follow = npsFollowUp(score);
  if (follow.alertOwner && !row.owner_alerted_at) {
    await sendContentMessageToOwners(db, 'content_nps_low_score_alert', {
      customer_name: row.customers?.full_name ?? 'A customer', score, comment: clean ?? 'no comment', customer_phone: row.customers?.phone ?? 'not on file',
    });
    await db.from('nps_responses').update({ owner_alerted_at: new Date().toISOString() }).eq('id', row.id);
  }
  const { data: settings } = await db.from('shop_settings').select('google_review_url').eq('id', 1).maybeSingle();
  return { ok: true, data: { reviewLink: settings?.google_review_url || `${siteUrl()}/review`, alertOwner: follow.alertOwner } };
}
