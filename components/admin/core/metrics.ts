import type { Enums } from '@/lib/db/database.types';
import { lineAmount } from '@/lib/work-orders/totals';
import { serviceTypeFor } from './service-types';

/* Pure KPI math for the owner dashboard. Inputs are plain rows; no I/O here. */

export const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export interface Window {
  start: number;
  end: number;
}

export function windows(now: number, days = 30): { current: Window; previous: Window } {
  return {
    current: { start: now - days * DAY_MS, end: now },
    previous: { start: now - 2 * days * DAY_MS, end: now - days * DAY_MS },
  };
}

const inWindow = (iso: string | null | undefined, w: Window) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= w.start && t < w.end;
};

export interface PaymentRow {
  amount_cents: number;
  created_at: string;
  title: string | null;
}

export interface CostLine {
  kind: Enums<'line_item_kind'>;
  quantity: number;
  unit_price_cents: number;
  unit_cost_cents: number | null;
  approval: Enums<'approval_state'>;
}

export interface PaidJobRow {
  total_cents: number;
  paid_at: string | null;
  lines: CostLine[];
  timeEntries: { started_at: string; ended_at: string | null }[];
}

export interface DecisionLine {
  created_at: string;
  approval: Enums<'approval_state'>;
  quantity: number;
  unit_price_cents: number;
}

export interface Kpi {
  key: string;
  label: string;
  format: 'money' | 'count' | 'percent';
  current: number | null;
  previous: number | null;
  hint: string;
}

const ratio = (num: number, den: number) => (den > 0 ? num / den : null);

function periodStats(w: Window, payments: PaymentRow[], paidJobs: PaidJobRow[], decisions: DecisionLine[]) {
  const revenue = payments.filter((p) => inWindow(p.created_at, w)).reduce((sum, p) => sum + p.amount_cents, 0);
  const jobs = paidJobs.filter((job) => inWindow(job.paid_at, w));
  const invoiced = jobs.reduce((sum, job) => sum + job.total_cents, 0);

  let billedHours = 0;
  let clockedHours = 0;
  let partsPrice = 0;
  let partsCost = 0;
  for (const job of jobs) {
    for (const line of job.lines) {
      if (line.approval !== 'approved') continue;
      if (line.kind === 'labor') billedHours += Number(line.quantity);
      if (line.kind === 'part' && line.unit_cost_cents !== null) {
        partsPrice += lineAmount(line);
        partsCost += Math.round(Number(line.quantity) * line.unit_cost_cents);
      }
    }
    for (const entry of job.timeEntries) {
      if (entry.ended_at) clockedHours += (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / HOUR_MS;
    }
  }

  const decided = decisions.filter((line) => inWindow(line.created_at, w));
  const approvedValue = decided.filter((l) => l.approval === 'approved').reduce((sum, l) => sum + lineAmount(l), 0);
  const declinedValue = decided.filter((l) => l.approval === 'declined').reduce((sum, l) => sum + lineAmount(l), 0);

  return {
    revenue,
    carCount: jobs.length,
    aro: jobs.length ? Math.round(invoiced / jobs.length) : null,
    approvalRate: ratio(approvedValue, approvedValue + declinedValue),
    efficiency: ratio(billedHours, clockedHours),
    partsMargin: ratio(partsPrice - partsCost, partsPrice),
  };
}

export function computeKpis(now: number, payments: PaymentRow[], paidJobs: PaidJobRow[], decisions: DecisionLine[]): Kpi[] {
  const { current, previous } = windows(now);
  const cur = periodStats(current, payments, paidJobs, decisions);
  const prev = periodStats(previous, payments, paidJobs, decisions);
  return [
    { key: 'revenue', label: 'Revenue', format: 'money', current: cur.revenue, previous: prev.revenue, hint: 'Payments collected' },
    { key: 'cars', label: 'Car count', format: 'count', current: cur.carCount, previous: prev.carCount, hint: 'Jobs paid in full' },
    { key: 'aro', label: 'Avg repair order', format: 'money', current: cur.aro, previous: prev.aro, hint: 'Paid invoice total ÷ jobs' },
    { key: 'approval', label: 'Estimate approval', format: 'percent', current: cur.approvalRate, previous: prev.approvalRate, hint: 'Approved $ ÷ approved + declined $' },
    { key: 'efficiency', label: 'Tech efficiency', format: 'percent', current: cur.efficiency, previous: prev.efficiency, hint: 'Billed labor hrs ÷ clocked hrs' },
    { key: 'margin', label: 'Parts margin', format: 'percent', current: cur.partsMargin, previous: prev.partsMargin, hint: 'Parts price − cost, on paid jobs' },
  ];
}

export interface Bucket {
  label: string;
  value: number;
}

/** Rolling 7-day weeks ending now, oldest first. */
export function weeklyRevenue(now: number, payments: PaymentRow[], weeks = 8): Bucket[] {
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  return Array.from({ length: weeks }, (_, index) => {
    const end = now - (weeks - 1 - index) * 7 * DAY_MS;
    const start = end - 7 * DAY_MS;
    const value = payments.filter((p) => inWindow(p.created_at, { start, end })).reduce((sum, p) => sum + p.amount_cents, 0);
    return { label: fmt.format(new Date(start + DAY_MS)), value };
  });
}

export function revenueByService(payments: PaymentRow[]): Bucket[] {
  const totals = new Map<string, number>();
  for (const payment of payments) {
    const type = serviceTypeFor(payment.title);
    totals.set(type, (totals.get(type) ?? 0) + payment.amount_cents);
  }
  return [...totals.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export const FUNNEL_STAGES = ['new', 'contacted', 'booked', 'won'] as const;

/** Leads that reached at least each stage. Lost leads count only as "new". */
export function leadFunnel(statuses: Enums<'lead_status'>[]): Bucket[] {
  const rank: Record<Enums<'lead_status'>, number> = { new: 0, lost: 0, contacted: 1, booked: 2, won: 3 };
  const labels = ['New', 'Contacted', 'Booked', 'Won'];
  return FUNNEL_STAGES.map((_, stage) => ({ label: labels[stage]!, value: statuses.filter((s) => rank[s] >= stage).length }));
}
