import 'server-only';
import { npsCategory, npsScore } from '@/lib/marketing/content/reputation';
import { getReviewWidget } from '@/lib/marketing/content/reputation-service';
import type { ReviewWidget } from '@/lib/marketing/content/reputation';
import { createAdminClient } from '@/lib/supabase/admin';

export const REVIEW_FILTERS = ['needs_reply', 'negative', 'all'] as const;
export type ReviewFilter = (typeof REVIEW_FILTERS)[number];

export interface ReplyView {
  id: string;
  text: string;
  status: string;
  compliance: 'pass' | 'warn' | 'block';
  issues: string[];
  postedAt: string | null;
  error: string | null;
}

export interface ReviewView {
  id: string;
  source: string;
  rating: number;
  body: string | null;
  author: string;
  reviewedAt: string;
  replied: boolean;
  isSample: boolean;
  alertedAt: string | null;
  reply: ReplyView | null;
}

export interface NpsWeek {
  label: string;
  score: number | null;
  responses: number;
}

export interface ReviewsOverview {
  reviews: ReviewView[];
  all: ReviewView[];
  counts: Record<ReviewFilter, number>;
  negatives: ReviewView[];
  nps: { score: number | null; promoters: number; passives: number; detractors: number; weeks: NpsWeek[]; lowScores: { score: number; comment: string | null; at: string }[] };
  requests: { sent: number; completed: number };
  widget: ReviewWidget;
}

const WEEKS = 8;
const WEEK_MS = 7 * 86_400_000;

function issueText(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((i) => (i && typeof i === 'object' && 'reason' in i ? String((i as { reason: unknown }).reason) : '')).filter(Boolean);
}

function npsWeeks(rows: readonly { score: number | null; responded_at: string | null }[], now: Date): NpsWeek[] {
  return Array.from({ length: WEEKS }, (_, i) => {
    const end = now.getTime() - (WEEKS - 1 - i) * WEEK_MS;
    const start = end - WEEK_MS;
    const scores = rows.filter((r) => r.score !== null && r.responded_at && new Date(r.responded_at).getTime() > start && new Date(r.responded_at).getTime() <= end).map((r) => r.score as number);
    const label = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', timeZone: 'America/New_York' }).format(new Date(end));
    return { label, score: npsScore(scores), responses: scores.length };
  });
}

export async function loadReviewsOverview(filter: ReviewFilter): Promise<ReviewsOverview> {
  const db = createAdminClient();
  const [{ data: rows, error }, { data: nps }, widget] = await Promise.all([
    db.from('reviews').select('*, review_replies(*)').order('reviewed_at', { ascending: false }).limit(200),
    db.from('nps_responses').select('score, comment, requested_at, responded_at').order('requested_at', { ascending: false }).limit(1000),
    getReviewWidget(6, db),
  ]);
  if (error) throw new Error(`Could not load reviews: ${error.message}`);

  const all: ReviewView[] = (rows ?? []).map((r) => {
    const latest = [...r.review_replies].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      id: r.id, source: r.source, rating: r.rating, body: r.body, author: r.author_name, reviewedAt: r.reviewed_at, replied: r.replied,
      isSample: r.source === 'sample' || r.author_name.startsWith('Sample'), alertedAt: r.owner_alerted_at,
      reply: latest ? {
        id: latest.id, text: latest.final_text ?? latest.draft_text, status: latest.status, compliance: latest.compliance_status as ReplyView['compliance'],
        issues: issueText(latest.compliance_issues), postedAt: latest.posted_at, error: latest.error,
      } : null,
    };
  });
  const publicFacing = all.filter((r) => r.source !== 'internal');
  const needsReply = publicFacing.filter((r) => !r.replied);
  const negatives = all.filter((r) => r.rating <= 3);
  const byFilter: Record<ReviewFilter, ReviewView[]> = { needs_reply: needsReply, negative: negatives, all };

  const responded = (nps ?? []).filter((n) => n.score !== null);
  const scores = responded.map((n) => n.score as number);
  return {
    reviews: byFilter[filter],
    all,
    counts: { needs_reply: needsReply.length, negative: negatives.length, all: all.length },
    negatives: negatives.filter((r) => !r.replied).slice(0, 5),
    nps: {
      score: npsScore(scores),
      promoters: scores.filter((s) => npsCategory(s) === 'promoter').length,
      passives: scores.filter((s) => npsCategory(s) === 'passive').length,
      detractors: scores.filter((s) => npsCategory(s) === 'detractor').length,
      weeks: npsWeeks(responded, new Date()),
      lowScores: responded.filter((n) => (n.score as number) <= 6).slice(0, 4).map((n) => ({ score: n.score as number, comment: n.comment, at: n.responded_at ?? n.requested_at })),
    },
    requests: { sent: nps?.length ?? 0, completed: responded.length },
    widget,
  };
}
