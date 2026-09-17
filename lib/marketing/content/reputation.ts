import { SHOP_FACTS } from './brand';
import { checkContent, type ComplianceReport } from './compliance';
import { hashSeed } from './demo-generator';

/**
 * Review replies, NPS and the public review widget. Rules that hold everywhere:
 * never offer anything for a review, never reveal job or personal details in
 * a public reply, never gate the review link on a score, never show sample or
 * internal reviews publicly.
 */

export const PUBLIC_REVIEW_SOURCES = ['google', 'facebook', 'manual'] as const;
export type ReviewSource = 'google' | 'facebook' | 'manual' | 'internal' | 'sample';

export const REPLY_RULES: readonly string[] = [
  'Thank them by first name only.',
  'Never mention the vehicle, VIN, invoice, price or any job detail.',
  'Never offer discounts, gifts or anything in exchange for a review or an edit.',
  'Negative: apologise once, don’t argue, invite them to call the owner directly.',
  'Keep it under 350 characters and sign as the shop.',
];

export function isNegative(rating: number): boolean {
  return rating <= 3;
}

export function firstName(author: string): string {
  const cleaned = author.replace(/^sample\s*[—-]\s*/i, '').trim();
  return cleaned.split(/\s+/)[0]?.replace(/[^\p{L}'-]/gu, '') || 'there';
}

const POSITIVE = [
  'Thanks, {name}. We appreciate you trusting us with your truck. See you next time.',
  'Thank you, {name}! Glad it all went well. Holler anytime you need us.',
  '{name}, thanks for taking the time to write this. It means a lot to a small shop.',
];
const NEUTRAL = [
  'Thanks for the feedback, {name}. We’re always working to do better. If there’s anything we can make right, call us at {phone}.',
  '{name}, thank you for the honest review. We’d like to hear more. Give us a call at {phone}.',
];
const NEGATIVE = [
  '{name}, thank you for telling us, and I’m sorry we fell short. That’s not how we want anyone to feel. Please call me directly at {phone} so I can make it right.',
  '{name}, I’m sorry about your experience. We take this seriously. Call {phone} and ask for the owner so we can talk it through.',
];

export interface ReplyDraft {
  text: string;
  tone: 'positive' | 'neutral' | 'negative';
  compliance: ComplianceReport;
}

/** Demo generator for review replies: deterministic, on-policy, compliance-checked. */
export function draftReviewReply(review: { id: string; rating: number; authorName: string }): ReplyDraft {
  const tone = review.rating >= 4 ? 'positive' : review.rating === 3 ? 'neutral' : 'negative';
  const pool = tone === 'positive' ? POSITIVE : tone === 'neutral' ? NEUTRAL : NEGATIVE;
  const template = pool[hashSeed(review.id) % pool.length]!;
  const text = template.replace('{name}', firstName(review.authorName)).replace('{phone}', SHOP_FACTS.phone);
  return { text, tone, compliance: checkReplyText(text) };
}

const INCENTIVE = /\b(discount|coupon|% off|\$\d+ off|free|gift card|credit|refund)\b/i;
const JOB_DETAIL = /\b(invoice|vin|work order|wo\s*#|\$\d)/i;

/** Compliance plus reply-specific rules, for AI drafts and owner edits alike. */
export function checkReplyText(text: string): ComplianceReport {
  const report = checkContent([text]);
  const issues = [...report.issues];
  if (INCENTIVE.test(text)) issues.push({ term: 'offer in a review reply', reason: 'Replies can’t offer anything; it reads as buying a review change.', severity: 'block' });
  if (JOB_DETAIL.test(text)) issues.push({ term: 'job details', reason: 'Public replies must not reveal invoices, prices or vehicle identifiers.', severity: 'block' });
  if (text.length > 600) issues.push({ term: 'length', reason: 'Keep replies short.', severity: 'warn' });
  const status = issues.some((i) => i.severity === 'block') ? 'block' : issues.length ? 'warn' : 'pass';
  return { status, issues };
}

export type NpsCategory = 'promoter' | 'passive' | 'detractor';

export function npsCategory(score: number): NpsCategory {
  return score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor';
}

/** Standard NPS: % promoters − % detractors, rounded. Null with no responses. */
export function npsScore(scores: readonly number[]): number | null {
  if (!scores.length) return null;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

/** Low scores alert the owner. Everyone, including low scorers, still gets the review link. */
export function npsFollowUp(score: number): { alertOwner: boolean; showReviewLink: true } {
  return { alertOwner: score <= 6, showReviewLink: true };
}

export interface WidgetReview {
  id: string;
  author: string;
  rating: number;
  body: string;
  source: 'google' | 'facebook' | 'manual';
  reviewedAt: string;
}

export interface ReviewWidget {
  average: number | null;
  count: number;
  reviews: WidgetReview[];
}

/** Builds public widget data. Anything not from a real review source is dropped here, whatever the caller passed. */
export function buildReviewWidget(rows: readonly { id: string; source: string; rating: number; body: string | null; author_name: string; reviewed_at: string }[], limit = 6): ReviewWidget {
  const real = rows.filter((r): r is typeof r & { source: WidgetReview['source'] } => (PUBLIC_REVIEW_SOURCES as readonly string[]).includes(r.source) && r.rating >= 1 && r.rating <= 5);
  const average = real.length ? Math.round((real.reduce((t, r) => t + r.rating, 0) / real.length) * 10) / 10 : null;
  const shown = real
    .filter((r) => r.body && r.body.trim().length > 0)
    .sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at))
    .slice(0, limit)
    .map((r) => {
      const [first, last] = r.author_name.trim().split(/\s+/);
      return { id: r.id, author: last ? `${first} ${last[0]}.` : first ?? 'Customer', rating: r.rating, body: r.body!.trim(), source: r.source, reviewedAt: r.reviewed_at };
    });
  return { average, count: real.length, reviews: shown };
}
