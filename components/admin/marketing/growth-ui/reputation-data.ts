import 'server-only';
import { themeCounts } from '@/lib/marketing/content/reputation-ops';
import { adminDb } from '@/lib/marketing/content/db';
import { replyOverdue, reviewVelocity, type ReviewTheme } from '@/lib/marketing/core/local-trigger-rules';

export interface ReputationOps {
  themes: { theme: ReviewTheme; count: number }[];
  overdue: { id: string; author: string; rating: number; hours: number; limit: number }[];
  velocity: { label: string; reviews: number; average: number | null }[];
  /** Requests sent per staff member — never reviews received (Google bans quotas). */
  requests: { name: string; sent: number }[];
  testimonials: { id: string; name: string; status: string; requestedAt: string }[];
}

/** Read-only reputation dashboard data. Each block degrades to empty. */
export async function loadReputationOps(now = new Date()): Promise<ReputationOps> {
  const db = adminDb();
  const [{ data: reviews }, { data: requests }, { data: testimonials }] = await Promise.all([
    db.from('reviews').select('id, author_name, rating, body, source, reviewed_at, themes, review_replies(id, status)').order('reviewed_at', { ascending: false }).limit(300),
    db.from('review_requests').select('requested_by, profiles(full_name)').limit(1000),
    db.from('video_testimonials').select('id, status, requested_at, customers(full_name)').order('requested_at', { ascending: false }).limit(20),
  ]);

  const rows = reviews ?? [];
  const byStaff = new Map<string, number>();
  for (const row of requests ?? []) {
    const name = row.profiles?.full_name ?? 'Unassigned';
    byStaff.set(name, (byStaff.get(name) ?? 0) + 1);
  }

  return {
    themes: themeCounts(rows.map((r) => ({ themes: r.themes ?? [] }))),
    overdue: rows
      .map((r) => ({ row: r, sla: replyOverdue({ rating: r.rating, reviewedAt: r.reviewed_at, replied: (r.review_replies ?? []).some((reply) => reply.status === 'posted'), source: r.source }, now) }))
      .filter((r) => r.sla.overdue)
      .slice(0, 10)
      .map(({ row, sla }) => ({ id: row.id, author: row.author_name, rating: row.rating, hours: sla.hours, limit: sla.limit })),
    velocity: reviewVelocity(rows.map((r) => ({ rating: r.rating, reviewedAt: r.reviewed_at, source: r.source })), now),
    requests: [...byStaff.entries()].map(([name, sent]) => ({ name, sent })).sort((a, b) => b.sent - a.sent).slice(0, 8),
    testimonials: (testimonials ?? []).map((t) => ({ id: t.id, name: t.customers?.full_name ?? 'Customer', status: t.status, requestedAt: t.requested_at })),
  };
}
