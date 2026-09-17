/** Pure report math: LTV, speed to lead, retention, cohorts, anomalies, digest, goals, budgets, calls. */

import type { DayStat } from './analytics-math';

const DAY_MS = 86_400_000;
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const share = (num: number, den: number): number | null => (den > 0 ? round3(num / den) : null);

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/* ─── LTV by source ─────────────────────────────────────────────────────── */

export interface PaidInvoice {
  customer_id: string;
  total_cents: number;
  paid_at: string;
}

export interface LtvRow {
  source: string;
  customers: number;
  paying: number;
  revenueCents: number;
  /** Revenue per paying customer. */
  ltvCents: number | null;
  repeatRate: number | null;
}

/** Lifetime paid revenue grouped by each customer's first-touch source. */
export function ltvBySource(customers: readonly { id: string; source: string }[], invoices: readonly PaidInvoice[]): LtvRow[] {
  const byCustomer = new Map<string, { cents: number; visits: number }>();
  for (const inv of invoices) {
    const entry = byCustomer.get(inv.customer_id) ?? { cents: 0, visits: 0 };
    byCustomer.set(inv.customer_id, { cents: entry.cents + Math.max(0, inv.total_cents), visits: entry.visits + 1 });
  }
  const rows = new Map<string, { customers: number; paying: number; repeat: number; cents: number }>();
  for (const c of customers) {
    const key = c.source || 'direct';
    const row = rows.get(key) ?? { customers: 0, paying: 0, repeat: 0, cents: 0 };
    const spent = byCustomer.get(c.id);
    rows.set(key, {
      customers: row.customers + 1,
      paying: row.paying + (spent ? 1 : 0),
      repeat: row.repeat + (spent && spent.visits > 1 ? 1 : 0),
      cents: row.cents + (spent?.cents ?? 0),
    });
  }
  return [...rows.entries()]
    .map(([source, r]) => ({ source, customers: r.customers, paying: r.paying, revenueCents: r.cents, ltvCents: r.paying ? Math.round(r.cents / r.paying) : null, repeatRate: share(r.repeat, r.paying) }))
    .sort((a, b) => (b.ltvCents ?? -1) - (a.ltvCents ?? -1) || b.customers - a.customers);
}

/* ─── Speed to lead ─────────────────────────────────────────────────────── */

export interface LeadTiming {
  created_at: string;
  first_response_at: string | null;
  booked: boolean;
}

export const SPEED_BUCKETS = [
  { label: 'Under 5 min', maxMinutes: 5 },
  { label: '5–60 min', maxMinutes: 60 },
  { label: '1–24 hours', maxMinutes: 1440 },
  { label: 'Over a day', maxMinutes: Infinity },
] as const;

export interface SpeedBucket {
  label: string;
  leads: number;
  booked: number;
  bookingRate: number | null;
}

export interface SpeedReport {
  leads: number;
  responded: number;
  medianMinutes: number | null;
  within5Rate: number | null;
  buckets: SpeedBucket[];
}

const digits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '').slice(-10);

/** First reply to a lead: the earlier of `contacted_at` and the first outbound message to its phone or email. */
export function firstResponseAt(
  lead: { created_at: string; contacted_at: string | null; phone: string | null; email: string | null },
  outbound: readonly { to_address: string; created_at: string }[],
): string | null {
  const start = Date.parse(lead.created_at);
  const phone = digits(lead.phone);
  const email = (lead.email ?? '').trim().toLowerCase();
  const times = outbound
    .filter((m) => Date.parse(m.created_at) >= start)
    .filter((m) => (phone.length === 10 && digits(m.to_address) === phone) || (email !== '' && m.to_address.trim().toLowerCase() === email))
    .map((m) => Date.parse(m.created_at));
  if (lead.contacted_at && Date.parse(lead.contacted_at) >= start) times.push(Date.parse(lead.contacted_at));
  return times.length ? new Date(Math.min(...times)).toISOString() : null;
}

export function speedToLead(leads: readonly LeadTiming[]): SpeedReport {
  const minutes: number[] = [];
  const buckets: SpeedBucket[] = [...SPEED_BUCKETS.map((b) => ({ label: b.label, leads: 0, booked: 0, bookingRate: null })), { label: 'No reply', leads: 0, booked: 0, bookingRate: null }];
  for (const lead of leads) {
    let index = buckets.length - 1;
    if (lead.first_response_at) {
      const m = Math.max(0, (Date.parse(lead.first_response_at) - Date.parse(lead.created_at)) / 60_000);
      minutes.push(m);
      index = SPEED_BUCKETS.findIndex((b) => m < b.maxMinutes);
    }
    buckets[index]!.leads += 1;
    if (lead.booked) buckets[index]!.booked += 1;
  }
  const med = median(minutes);
  return {
    leads: leads.length,
    responded: minutes.length,
    medianMinutes: med === null ? null : Math.round(med * 10) / 10,
    within5Rate: share(minutes.filter((m) => m < 5).length, leads.length),
    buckets: buckets.map((b) => ({ ...b, bookingRate: share(b.booked, b.leads) })),
  };
}

/* ─── Retention & cohorts ───────────────────────────────────────────────── */

export interface RetentionReport {
  customers: number;
  returning: number;
  returningRate: number | null;
  medianDaysBetween: number | null;
  /** Paid in the prior 12 months and again in the last 12. */
  retained12mRate: number | null;
  /** Last paid visit over a year ago. */
  lapsed: number;
}

function visitsByCustomer(invoices: readonly PaidInvoice[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const inv of invoices) {
    const t = Date.parse(inv.paid_at);
    if (Number.isNaN(t)) continue;
    map.set(inv.customer_id, [...(map.get(inv.customer_id) ?? []), t]);
  }
  for (const times of map.values()) times.sort((a, b) => a - b);
  return map;
}

export function retentionReport(invoices: readonly PaidInvoice[], now: Date): RetentionReport {
  const visits = visitsByCustomer(invoices);
  const yearAgo = now.getTime() - 365 * DAY_MS;
  const twoYearsAgo = now.getTime() - 730 * DAY_MS;
  const gaps: number[] = [];
  let returning = 0;
  let lapsed = 0;
  let priorYear = 0;
  let retained = 0;
  for (const times of visits.values()) {
    if (times.length > 1) returning += 1;
    for (let i = 1; i < times.length; i += 1) gaps.push((times[i]! - times[i - 1]!) / DAY_MS);
    if (times[times.length - 1]! < yearAgo) lapsed += 1;
    if (times.some((t) => t >= twoYearsAgo && t < yearAgo)) {
      priorYear += 1;
      if (times.some((t) => t >= yearAgo)) retained += 1;
    }
  }
  const med = median(gaps);
  return {
    customers: visits.size,
    returning,
    returningRate: share(returning, visits.size),
    medianDaysBetween: med === null ? null : Math.round(med),
    retained12mRate: share(retained, priorYear),
    lapsed,
  };
}

export interface CohortRow {
  cohort: string;
  size: number;
  /** Share of the cohort with a paid visit k months after their first; null = not reached yet. */
  cells: (number | null)[];
}

const monthIndex = (t: number) => {
  const d = new Date(t);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
};
const monthLabel = (index: number) => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;

/** Month of first paid visit × months later, for the last `months` cohorts. Cell 0 is the first-visit month itself. */
export function cohortGrid(invoices: readonly PaidInvoice[], now: Date, months = 6): CohortRow[] {
  const current = monthIndex(now.getTime());
  const cohorts = new Map<number, Set<number>[]>();
  for (const times of visitsByCustomer(invoices).values()) {
    const first = monthIndex(times[0]!);
    if (first <= current - months) continue;
    const offsets = new Set(times.map((t) => monthIndex(t) - first));
    cohorts.set(first, [...(cohorts.get(first) ?? []), offsets]);
  }
  const rows: CohortRow[] = [];
  for (let m = current - months + 1; m <= current; m += 1) {
    const members = cohorts.get(m) ?? [];
    const cells = Array.from({ length: months }, (_, k) => (m + k > current ? null : members.length ? round3(members.filter((o) => o.has(k)).length / members.length) : 0));
    rows.push({ cohort: monthLabel(m), size: members.length, cells });
  }
  return rows;
}

/** Service-due reminders followed by a booking within `windowDays`. */
export function reminderConversion(
  reminders: readonly { customer_id: string | null; created_at: string }[],
  bookings: readonly { customer_id: string; created_at: string }[],
  windowDays = 30,
): { sent: number; booked: number; rate: number | null } {
  const sent = reminders.filter((r) => r.customer_id);
  const booked = sent.filter((r) => {
    const start = Date.parse(r.created_at);
    return bookings.some((b) => b.customer_id === r.customer_id && Date.parse(b.created_at) >= start && Date.parse(b.created_at) <= start + windowDays * DAY_MS);
  }).length;
  return { sent: sent.length, booked, rate: share(booked, sent.length) };
}

/* ─── Weekly windows, anomalies and the digest ──────────────────────────── */

export interface WeekTotals {
  leads: number;
  bookings: number;
  revenueCents: number;
  spendCents: number;
}

export function sumDays(days: readonly DayStat[]): WeekTotals {
  return days.reduce((t, d) => ({ leads: t.leads + d.leads, bookings: t.bookings + d.bookings, revenueCents: t.revenueCents + d.revenueCents, spendCents: t.spendCents + d.spendCents }), { leads: 0, bookings: 0, revenueCents: 0, spendCents: 0 });
}

/** Monday (YYYY-MM-DD) of the week containing a calendar day key. */
export function weekStartOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
}

export type AnomalyMetric = 'leads' | 'bookings' | 'spend' | 'cpl';

export interface Anomaly {
  metric: AnomalyMetric;
  direction: 'up' | 'down';
  current: number;
  baseline: number;
  changeRatio: number;
  message: string;
  dedupeKey: string;
}

/** A weekly count needs this much volume before a swing means anything. */
export const ANOMALY_MIN_WEEKLY = { leads: 4, bookings: 3, spendCents: 5_000 } as const;
export const ANOMALY_THRESHOLD = 0.5;

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;

/**
 * Compares the last 7 complete days with the weekly average of the 28 before.
 * `days` must be chronological and end with the most recent complete day.
 */
export function detectAnomalies(days: readonly DayStat[]): Anomaly[] {
  if (days.length < 35) return [];
  const current = sumDays(days.slice(-7));
  const base = sumDays(days.slice(-35, -7));
  const baseline = { leads: base.leads / 4, bookings: base.bookings / 4, spendCents: base.spendCents / 4 };
  const week = weekStartOf(days[days.length - 1]!.date);
  const found: Anomaly[] = [];
  const check = (metric: AnomalyMetric, now: number, was: number, minVolume: number, label: (n: number) => string, riseIsBad: boolean) => {
    if (Math.max(now, was) < minVolume || was <= 0) return;
    const change = (now - was) / was;
    if (Math.abs(change) < ANOMALY_THRESHOLD) return;
    const direction = change > 0 ? 'up' : 'down';
    if (metric === 'cpl' && !riseIsBad) return;
    const pctText = `${Math.round(Math.abs(change) * 100)}%`;
    found.push({
      metric, direction, current: Math.round(now * 100) / 100, baseline: Math.round(was * 100) / 100, changeRatio: Math.round(change * 1000) / 1000,
      message: `${metric === 'cpl' ? 'Cost per lead' : metric.charAt(0).toUpperCase() + metric.slice(1)} ${direction} ${pctText}: ${label(now)} this week vs ${label(was)} usual.`,
      dedupeKey: `${metric}:${direction}:${week}`,
    });
  };
  check('leads', current.leads, baseline.leads, ANOMALY_MIN_WEEKLY.leads, (n) => `${Math.round(n)}`, false);
  check('bookings', current.bookings, baseline.bookings, ANOMALY_MIN_WEEKLY.bookings, (n) => `${Math.round(n)}`, false);
  check('spend', current.spendCents, baseline.spendCents, ANOMALY_MIN_WEEKLY.spendCents, money, true);
  const cplNow = current.leads ? current.spendCents / current.leads : 0;
  const cplWas = baseline.leads ? baseline.spendCents / baseline.leads : 0;
  if (current.leads >= 2 && baseline.leads >= ANOMALY_MIN_WEEKLY.leads / 2 && current.spendCents >= ANOMALY_MIN_WEEKLY.spendCents) {
    check('cpl', cplNow, cplWas, 1, money, cplNow > cplWas);
  }
  return found;
}

export interface Digest {
  headline: string;
  lines: string[];
  text: string;
}

function delta(now: number, was: number): string {
  if (was <= 0) return now > 0 ? 'new' : 'flat';
  const change = Math.round(((now - was) / was) * 100);
  return change === 0 ? 'flat' : `${change > 0 ? '+' : ''}${change}%`;
}

/** Plain-text Monday digest: last week vs the week before. */
export function buildDigest(input: { weekStart: string; current: WeekTotals; previous: WeekTotals; topSource: string | null; openAlerts: number; goalLine: string | null }): Digest {
  const { current: c, previous: p } = input;
  const cpl = c.leads && c.spendCents ? money(c.spendCents / c.leads) : '—';
  const lines = [
    `Leads: ${c.leads} (${delta(c.leads, p.leads)})`,
    `Booked: ${c.bookings} (${delta(c.bookings, p.bookings)})`,
    `Revenue: ${money(c.revenueCents)} (${delta(c.revenueCents, p.revenueCents)})`,
    `Ad spend: ${money(c.spendCents)} · cost per lead ${cpl}`,
    input.topSource ? `Top source: ${input.topSource}` : null,
    input.goalLine,
    input.openAlerts ? `${input.openAlerts} ${input.openAlerts === 1 ? 'alert needs' : 'alerts need'} a look` : null,
  ].filter((line): line is string => Boolean(line));
  const headline = `Week of ${input.weekStart}: ${c.leads} leads, ${c.bookings} booked`;
  return { headline, lines, text: `${headline}\n\n${lines.map((l) => `• ${l}`).join('\n')}` };
}

/* ─── Goals & budgets ───────────────────────────────────────────────────── */

export type GoalMetric = 'leads' | 'bookings' | 'revenue' | 'max_cpl';

export const GOAL_METRICS: readonly { value: GoalMetric; label: string; money: boolean }[] = [
  { value: 'leads', label: 'Leads', money: false },
  { value: 'bookings', label: 'Bookings', money: false },
  { value: 'revenue', label: 'Revenue', money: true },
  { value: 'max_cpl', label: 'Max cost / lead', money: true },
];

export interface GoalProgress {
  metric: GoalMetric;
  label: string;
  target: number;
  actual: number;
  /** actual ÷ target (for max_cpl, lower is better). */
  ratio: number;
  onPace: boolean;
}

/** Elapsed share of the month (0–1] for pacing. */
export function monthElapsed(now: Date, timeZone = 'America/New_York'): number {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const daysInMonth = new Date(Date.UTC(get('year'), get('month'), 0)).getUTCDate();
  return Math.min(1, get('day') / daysInMonth);
}

export function goalProgress(goals: readonly { metric: string; target: number }[], actual: { leads: number; bookings: number; revenueCents: number; costPerLeadCents: number | null }, elapsed: number): GoalProgress[] {
  return GOAL_METRICS.flatMap(({ value, label }) => {
    const goal = goals.find((g) => g.metric === value);
    if (!goal || goal.target <= 0) return [];
    const now = value === 'leads' ? actual.leads : value === 'bookings' ? actual.bookings : value === 'revenue' ? actual.revenueCents : actual.costPerLeadCents ?? 0;
    const ratio = Math.round((now / goal.target) * 1000) / 1000;
    const onPace = value === 'max_cpl' ? now <= goal.target : ratio >= elapsed * 0.9;
    return [{ metric: value, label, target: goal.target, actual: now, ratio, onPace }];
  });
}

export const BUDGET_CHANNELS = ['google', 'facebook', 'instagram', 'tiktok', 'bing', 'print', 'events', 'sponsorship', 'other'] as const;
export type BudgetChannel = (typeof BUDGET_CHANNELS)[number];

export interface BudgetRow {
  channel: string;
  budgetCents: number;
  adSpendCents: number;
  manualSpendCents: number;
  actualCents: number;
  /** Spend ÷ (budget × elapsed month). >1 means ahead of plan. */
  pace: number | null;
}

export function budgetVsActual(
  budgets: readonly { channel: string; budget_cents: number; manual_spend_cents: number }[],
  adSpend: readonly { source: string; spend_cents: number }[],
  elapsed: number,
): { rows: BudgetRow[]; total: BudgetRow } {
  const rows = new Map<string, BudgetRow>();
  const row = (channel: string) => {
    const key = (BUDGET_CHANNELS as readonly string[]).includes(channel) ? channel : 'other';
    if (!rows.has(key)) rows.set(key, { channel: key, budgetCents: 0, adSpendCents: 0, manualSpendCents: 0, actualCents: 0, pace: null });
    return rows.get(key)!;
  };
  for (const b of budgets) {
    const r = row(b.channel);
    r.budgetCents += b.budget_cents;
    r.manualSpendCents += b.manual_spend_cents;
  }
  for (const s of adSpend) row(s.source).adSpendCents += Math.max(0, s.spend_cents);
  const finish = (r: BudgetRow): BudgetRow => {
    const actualCents = r.adSpendCents + r.manualSpendCents;
    return { ...r, actualCents, pace: r.budgetCents > 0 && elapsed > 0 ? Math.round((actualCents / (r.budgetCents * elapsed)) * 100) / 100 : null };
  };
  const list = BUDGET_CHANNELS.flatMap((c) => (rows.has(c) ? [finish(rows.get(c)!)] : []));
  const total = finish(list.reduce((t, r) => ({ ...t, budgetCents: t.budgetCents + r.budgetCents, adSpendCents: t.adSpendCents + r.adSpendCents, manualSpendCents: t.manualSpendCents + r.manualSpendCents }), { channel: 'total', budgetCents: 0, adSpendCents: 0, manualSpendCents: 0, actualCents: 0, pace: null } as BudgetRow));
  return { rows: list, total };
}

/* ─── Call attribution ──────────────────────────────────────────────────── */

export const MISSED_STATUSES = ['no-answer', 'busy', 'failed', 'canceled'] as const;

export interface CallRow {
  source: string;
  label: string;
  calls: number;
  missed: number;
  textedBack: number;
  knownCustomers: number;
}

export function callAttribution(
  calls: readonly { to_number: string | null; call_status: string; customer_id: string | null; texted_back_at: string | null }[],
  numbers: readonly { phone: string; source: string; label: string }[],
): CallRow[] {
  const byTail = new Map(numbers.map((n) => [digits(n.phone), n]));
  const rows = new Map<string, CallRow>();
  for (const call of calls) {
    const tracked = byTail.get(digits(call.to_number));
    const key = tracked ? tracked.phone : 'untracked';
    const row = rows.get(key) ?? { source: tracked?.source ?? 'untracked', label: tracked?.label || (tracked ? tracked.phone : 'Main line'), calls: 0, missed: 0, textedBack: 0, knownCustomers: 0 };
    row.calls += 1;
    if ((MISSED_STATUSES as readonly string[]).includes(call.call_status)) row.missed += 1;
    if (call.texted_back_at) row.textedBack += 1;
    if (call.customer_id) row.knownCustomers += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.calls - a.calls);
}
