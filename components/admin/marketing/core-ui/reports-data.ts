import 'server-only';
import {
  getBudgetReport, getCallReport, getGoals, getLtvBySource, getMarketingFunnel, getRetention, getSpeedToLead,
  type AttributionModel, type FunnelReport,
} from '@/lib/marketing/core/analytics';
import { dayKey, startOfDayInZone } from '@/lib/marketing/core/analytics-math';
import { goalProgress, monthElapsed, type BudgetRow, type CallRow, type CohortRow, type GoalProgress, type LtvRow, type RetentionReport, type SpeedReport } from '@/lib/marketing/core/analytics-reports';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables } from '@/lib/db/database.types';

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 90;

export interface GoalEditRow {
  metric: string;
  target: number;
}

export interface ReportsData {
  month: string;
  model: AttributionModel;
  funnel: FunnelReport | null;
  funnelError: string | null;
  ltv: LtvRow[];
  speed: SpeedReport | null;
  retention: RetentionReport | null;
  cohorts: CohortRow[];
  reminders: { sent: number; booked: number; rate: number | null };
  goals: GoalEditRow[];
  goalProgress: GoalProgress[];
  budget: { rows: BudgetRow[]; total: BudgetRow };
  budgetInputs: { channel: string; budget_cents: number; manual_spend_cents: number }[];
  digests: Pick<Tables<'marketing_digests'>, 'id' | 'week_start' | 'body' | 'sent_count' | 'send_detail'>[];
  anomalies: Pick<Tables<'marketing_anomalies'>, 'id' | 'metric' | 'direction' | 'message' | 'created_at' | 'acknowledged_at' | 'alerted'>[];
  calls: CallRow[];
  numbers: { id: string; phone: string; source: string; label: string }[];
  feeds: Pick<Tables<'marketing_report_feeds'>, 'id' | 'label' | 'last_used_at' | 'revoked_at' | 'created_at'>[];
}

/** Everything the Reports page shows. Each block degrades to empty rather than failing the page. */
export async function loadReports(model: AttributionModel, month: string, now = new Date()): Promise<ReportsData> {
  const db = createAdminClient();
  const from = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const monthStart = startOfDayInZone(`${month}-01`);
  const nextMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 7);
  const monthEnd = new Date(startOfDayInZone(`${nextMonth}-01`).getTime() - 1);
  const monthTo = monthEnd < now ? monthEnd : now;

  const [funnelResult, monthFunnel, ltv, speed, retention, goals, budget, digests, anomalies, calls, feeds] = await Promise.all([
    getMarketingFunnel({ from, to: now, model }, db).then(
      (funnel) => ({ funnel, error: null as string | null }),
      (caught: unknown) => ({ funnel: null, error: caught instanceof Error ? caught.message : 'Funnel unavailable' }),
    ),
    getMarketingFunnel({ from: monthStart, to: monthTo, model }, db).then((f) => f.totals, () => null),
    getLtvBySource(db).catch(() => [] as LtvRow[]),
    getSpeedToLead(db, from, now).catch(() => null),
    getRetention(db, now).catch(() => null),
    getGoals(db, month).catch(() => [] as GoalEditRow[]),
    getBudgetReport(db, month, now).catch(() => null),
    db.from('marketing_digests').select('id, week_start, body, sent_count, send_detail').order('week_start', { ascending: false }).limit(6),
    db.from('marketing_anomalies').select('id, metric, direction, message, created_at, acknowledged_at, alerted').order('created_at', { ascending: false }).limit(12),
    getCallReport(db, from).catch(() => ({ rows: [] as CallRow[], numbers: [] as ReportsData['numbers'] })),
    db.from('marketing_report_feeds').select('id, label, last_used_at, revoked_at, created_at').order('created_at', { ascending: false }).limit(10),
  ]);

  const elapsed = now >= monthEnd ? 1 : now < monthStart ? 0 : monthElapsed(now);
  return {
    month,
    model,
    funnel: funnelResult.funnel,
    funnelError: funnelResult.error,
    ltv,
    speed,
    retention: retention?.retention ?? null,
    cohorts: retention?.cohorts ?? [],
    reminders: retention?.reminders ?? { sent: 0, booked: 0, rate: null },
    goals,
    goalProgress: monthFunnel
      ? goalProgress(goals, { leads: monthFunnel.leads, bookings: monthFunnel.bookings, revenueCents: monthFunnel.revenueCents, costPerLeadCents: monthFunnel.costPerLeadCents }, elapsed)
      : [],
    budget: budget?.report ?? { rows: [], total: { channel: 'total', budgetCents: 0, adSpendCents: 0, manualSpendCents: 0, actualCents: 0, pace: null } },
    budgetInputs: budget?.inputs ?? [],
    digests: digests.data ?? [],
    anomalies: anomalies.data ?? [],
    calls: calls.rows,
    numbers: calls.numbers,
    feeds: feeds.data ?? [],
  };
}

/** Current month key (YYYY-MM) in shop time. */
export function currentMonth(now = new Date()): string {
  return dayKey(now).slice(0, 7);
}
