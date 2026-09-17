import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { emit } from '@/lib/automations/engine';
import { firstName as firstNameOf } from '@/lib/format';
import { siteUrl } from '@/lib/site-url';
import { canAutoPostReply, tagThemes, type ReviewTheme } from '@/lib/marketing/core/local-trigger-rules';
import { submitForApproval, decideApproval } from './approvals-service';
import { adminDb, fail, toJson, type Db, type Result } from './db';
import { firstName } from './reputation';
import { postReviewReply } from './reputation-service';
import { hashtagsFor } from './social';

const HOUR_MS = 3_600_000;
const TESTIMONIAL_TTL_DAYS = 30;
export const TESTIMONIAL_MAX_BYTES = 200 * 1024 * 1024;
export const TESTIMONIAL_MIME = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

export const tokenHash = (token: string): string => createHash('sha256').update(token).digest('hex');

// ─── Themes ─────────────────────────────────────────────────────────────────

/** Keyword-tags recent reviews and survey comments that have no themes yet. */
export async function tagReviewThemes(db: Db = adminDb(), limit = 200): Promise<{ reviews: number; surveys: number }> {
  const [{ data: reviews }, { data: surveys }] = await Promise.all([
    db.from('reviews').select('id, body, themes').not('body', 'is', null).order('reviewed_at', { ascending: false }).limit(limit),
    db.from('nps_responses').select('id, comment, themes').not('comment', 'is', null).order('requested_at', { ascending: false }).limit(limit),
  ]);
  let tagged = 0;
  for (const review of reviews ?? []) {
    const themes = tagThemes(review.body);
    if (!themes.length || review.themes.length) continue;
    await db.from('reviews').update({ themes }).eq('id', review.id);
    tagged += 1;
  }
  let surveyTagged = 0;
  for (const survey of surveys ?? []) {
    const themes = tagThemes(survey.comment);
    if (!themes.length || survey.themes.length) continue;
    await db.from('nps_responses').update({ themes }).eq('id', survey.id);
    surveyTagged += 1;
  }
  return { reviews: tagged, surveys: surveyTagged };
}

export function themeCounts(rows: readonly { themes: string[] }[]): { theme: ReviewTheme; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) for (const theme of row.themes) counts.set(theme, (counts.get(theme) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([theme, count]) => ({ theme: theme as ReviewTheme, count }));
}

// ─── Auto-publish clean 5-star replies ──────────────────────────────────────

/**
 * Setting-gated: a 5-star reply draft the owner hasn't touched in two hours is
 * approved and posted automatically. Anything below 5 stars always waits.
 */
/** The owner account the auto-approval is recorded against. */
async function ownerProfileId(db: Db): Promise<string | null> {
  const { data } = await db.from('profiles').select('id').eq('role', 'admin').eq('active', true).order('created_at').limit(1).maybeSingle();
  return data?.id ?? null;
}

export async function autoPostPositiveReplies(now = new Date(), db: Db = adminDb()): Promise<{ posted: number; skipped: number; off?: true }> {
  const { data: settings } = await db.from('marketing_settings').select('auto_post_positive_replies').eq('id', 1).maybeSingle();
  if (!settings?.auto_post_positive_replies) return { posted: 0, skipped: 0, off: true };
  const since = new Date(now.getTime() - 14 * 24 * HOUR_MS).toISOString();
  const { data: replies } = await db
    .from('review_replies')
    .select('id, draft_text, final_text, status, compliance_status, created_at, reviews(rating)')
    .eq('status', 'pending_approval')
    .gte('created_at', since)
    .limit(50);
  let posted = 0;
  let skipped = 0;
  for (const reply of replies ?? []) {
    const ready = canAutoPostReply({
      rating: reply.reviews?.rating ?? 0, status: reply.status, compliance: reply.compliance_status,
      edited: Boolean(reply.final_text && reply.final_text !== reply.draft_text), createdAt: reply.created_at,
    }, now);
    if (!ready) {
      skipped += 1;
      continue;
    }
    const { data: approval } = await db.from('marketing_approvals').select('id').eq('subject_type', 'review_reply').eq('subject_id', reply.id).eq('decision', 'pending').order('requested_at', { ascending: false }).limit(1).maybeSingle();
    if (!approval) {
      skipped += 1;
      continue;
    }
    const owner = await ownerProfileId(db);
    if (!owner) return { posted, skipped: skipped + 1 };
    const decided = await decideApproval({ approvalId: approval.id, decision: 'approved', decidedBy: owner, notes: 'Auto-approved: clean 5-star reply' }, db);
    if (!decided.ok) {
      skipped += 1;
      continue;
    }
    const sent = await postReviewReply(reply.id, db);
    if (sent.ok) posted += 1;
    else skipped += 1;
  }
  return { posted, skipped };
}

// ─── Review → social card ───────────────────────────────────────────────────

const MIN_SOCIAL_REVIEW_CHARS = 40;

/** Queues a social post from a 5-star review: first name only, no job details. */
export async function createReviewSocialPost(reviewId: string, requestedBy: string | null = null, db: Db = adminDb()): Promise<Result<{ postId: string; created: boolean }>> {
  try {
    const { data: review } = await db.from('reviews').select('id, rating, body, author_name, source, social_post_id').eq('id', reviewId).maybeSingle();
    if (!review) return { ok: false, error: 'Review not found.' };
    if (review.social_post_id) return { ok: true, data: { postId: review.social_post_id, created: false } };
    if (review.rating < 5) return { ok: false, error: 'Only 5-star reviews get a card.' };
    if (review.source === 'internal' || review.source === 'sample') return { ok: false, error: 'Private feedback can’t be posted.' };
    const quote = (review.body ?? '').trim();
    if (quote.length < MIN_SOCIAL_REVIEW_CHARS) return { ok: false, error: 'Needs a longer review to quote.' };

    const author = firstName(review.author_name);
    const short = quote.length > 180 ? `${quote.slice(0, 177).trimEnd()}…` : quote;
    const { data: post, error } = await db.from('social_posts').insert({
      title: `Review from ${author}`,
      caption: `“${short}”\n\n— ${author}, ${review.source === 'google' ? 'Google' : 'customer'} review. Thank you.`,
      hashtags: hashtagsFor(null, ['review']),
      link_url: `${siteUrl()}/reviews`,
      image_template: 'review',
      image_params: toJson({ quote: short, author, rating: 5 }),
      pillar: 'proof',
      source_type: 'review',
      source_id: review.id,
      generator: 'demo',
      created_by: requestedBy,
      compliance_status: 'pass',
      needs_privacy_review: false,
      privacy_note: 'First name only. No plate, VIN or job detail.',
    }).select('id').single();
    if (error || !post) return { ok: false, error: error?.message ?? 'Could not create the post.' };
    await db.from('social_post_targets').insert([{ post_id: post.id, platform: 'instagram' }, { post_id: post.id, platform: 'facebook' }]);
    await db.from('reviews').update({ social_post_id: post.id }).eq('id', review.id);
    const queued = await submitForApproval('social_post', post.id, requestedBy, db);
    if (!queued.ok) return queued;
    return { ok: true, data: { postId: post.id, created: true } };
  } catch (error) {
    return fail(error);
  }
}

// ─── Manual review asks (staff leaderboard) ─────────────────────────────────

/** Logs a staff member's manual review ask and fires the normal request automation. */
export async function logReviewRequest(customerId: string, requestedBy: string | null, channel: 'sms' | 'email' | 'both', db: Db = adminDb()): Promise<Result<{ sent: boolean }>> {
  try {
    const { scheduled } = await emit({ name: 'marketing.review_request_manual', subjectType: 'customer', subjectId: customerId, discriminator: `manual:${new Date().toISOString().slice(0, 10)}`, context: {} });
    const { error } = await db.from('review_requests').insert({ customer_id: customerId, requested_by: requestedBy, channel, sent: scheduled > 0 });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { sent: scheduled > 0 } };
  } catch (error) {
    return fail(error);
  }
}

// ─── Video testimonials ─────────────────────────────────────────────────────

export const RELEASE_TEXT =
  'I give Lucky Diesel permission to share this video on its website and social accounts. I can ask them to take it down at any time.';

/** Creates a one-time upload link and sends it. The customer picks what may be shared. */
export async function requestVideoTestimonial(customerId: string, requestedBy: string | null = null, db: Db = adminDb()): Promise<Result<{ uploadUrl: string }>> {
  try {
    const { data: customer } = await db.from('customers').select('id, full_name, email, phone').eq('id', customerId).maybeSingle();
    if (!customer) return { ok: false, error: 'Customer not found.' };
    const token = randomBytes(24).toString('base64url');
    const { error } = await db.from('video_testimonials').insert({
      customer_id: customerId, token_hash: tokenHash(token), requested_by: requestedBy,
      expires_at: new Date(Date.now() + TESTIMONIAL_TTL_DAYS * 24 * HOUR_MS).toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    const uploadUrl = `${siteUrl()}/api/marketing/testimonial?t=${token}`;
    await emit({
      name: 'marketing.video_testimonial_request', subjectType: 'customer', subjectId: customerId,
      discriminator: `testimonial:${token.slice(0, 8)}`,
      context: { first_name: firstNameOf(customer.full_name), upload_link: uploadUrl },
    });
    return { ok: true, data: { uploadUrl } };
  } catch (error) {
    return fail(error);
  }
}

/** Stores an uploaded video in the private bucket and records the release the customer accepted. */
export async function saveVideoTestimonial(token: string, file: File, releaseAccepted: boolean, db: Db = adminDb()): Promise<Result<{ id: string }>> {
  try {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { ok: false, error: 'This upload link is not valid.' };
    if (!releaseAccepted) return { ok: false, error: 'Tick the permission box so we know what we may share.' };
    if (!(TESTIMONIAL_MIME as readonly string[]).includes(file.type)) return { ok: false, error: 'Use an MP4, MOV or WebM video.' };
    if (file.size <= 0 || file.size > TESTIMONIAL_MAX_BYTES) return { ok: false, error: 'Videos must be under 200 MB.' };
    const { data: row } = await db.from('video_testimonials').select('id, status, expires_at').eq('token_hash', tokenHash(token)).maybeSingle();
    if (!row) return { ok: false, error: 'This upload link has expired.' };
    if (Date.parse(row.expires_at) < Date.now()) return { ok: false, error: 'This upload link has expired.' };
    if (row.status !== 'requested') return { ok: false, error: 'We already have your video. Thank you!' };

    const extension = file.type === 'video/mp4' ? 'mp4' : file.type === 'video/webm' ? 'webm' : 'mov';
    const path = `${row.id}.${extension}`;
    const { error: uploadError } = await db.storage.from('testimonials').upload(path, file, { contentType: file.type, upsert: true });
    if (uploadError) return { ok: false, error: 'Upload failed. Try again on wifi.' };
    const { error } = await db.from('video_testimonials').update({
      status: 'uploaded', storage_path: path, uploaded_at: new Date().toISOString(),
      release_accepted_at: new Date().toISOString(), release_text: RELEASE_TEXT,
    }).eq('id', row.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return fail(error);
  }
}

/** Owner decision on an uploaded video. Rejected videos keep the row for the record. */
export async function decideVideoTestimonial(id: string, decision: 'approved' | 'rejected', db: Db = adminDb()): Promise<Result<{ status: string }>> {
  const { error } = await db.from('video_testimonials').update({ status: decision }).eq('id', id).eq('status', 'uploaded');
  return error ? { ok: false, error: error.message } : { ok: true, data: { status: decision } };
}

/** Short-lived private link so the owner can watch an upload. */
export async function testimonialViewUrl(id: string, db: Db = adminDb()): Promise<string | null> {
  const { data: row } = await db.from('video_testimonials').select('storage_path').eq('id', id).maybeSingle();
  if (!row?.storage_path) return null;
  const { data } = await db.storage.from('testimonials').createSignedUrl(row.storage_path, 600);
  return data?.signedUrl ?? null;
}
