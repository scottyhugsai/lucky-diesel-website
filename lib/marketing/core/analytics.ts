import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  campaignReport, dailySeries, dayKey, funnelTotals, grossProfitCents, rollupFunnel, SPEND_SOURCE_BY_PLATFORM, startOfDayInZone,
  type AttributionModel, type CampaignVariantReport, type ConversionRow, type CostedLine, type DayStat, type FunnelRow, type SpendRow, type TouchPoint,
} from './analytics-math';
import {
  budgetVsActual, callAttribution, cohortGrid, firstResponseAt, ltvBySource, monthElapsed, reminderConversion, retentionReport, speedToLead,
  type CallRow, type CohortRow, type LtvRow, type PaidInvoice, type RetentionReport, type SpeedReport,
} from './analytics-reports';
import { normalizeSourceName } from './attribution-touch';
import type { Db } from './settings';

export type { AttributionModel, CampaignVariantReport, DayStat, FunnelRow } from './analytics-math';

export interface FunnelReport {
  from: string;
  to: string;
  model: AttributionModel;
  rows: FunnelRow[];
  totals: FunnelRow;
  /** False when part B's ad tables are absent; CPL/ROAS then show as null. */
  hasSpendData: boolean;
}

const DAY_MS = 86_400_000;

/** Ad spend by attributed source from `ad_metrics_daily` (part B). Missing tables yield no rows. */
export async function loadAdSpend(db: Db, from: Date, to: Date): Promise<{ rows: SpendRow[]; available: boolean }> {
  const { data, error } = await db
    .from('ad_metrics_daily')
    .select('spend_cents, date, ad_publications(platform)')
    .gte('date', from.toISOString().slice(0, 10))
    .lte('date', to.toISOString().slice(0, 10));
  if (error) return { rows: [], available: false };
  const rows = (data ?? []).map((m) => ({ source: SPEND_SOURCE_BY_PLATFORM[m.ad_publications?.platform ?? ''] ?? 'other', spend_cents: m.spend_cents }));
  return { rows, available: true };
}

const PAGE = 1000;
const MAX_ROWS = 20_000;
const IN_CHUNK = 150;

/** Pages through a query past PostgREST's row cap, up to MAX_ROWS. */
export async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const { data, error } = await page(offset, offset + PAGE - 1);
    if (error) throw new Error(`${label} query failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function chunks<T>(items: readonly T[], size = IN_CHUNK): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

const MULTI_TOUCH: readonly AttributionModel[] = ['linear', 'time_decay', 'position'];
/** Touches older than this before the window can still earn multi-touch credit. */
const TOUCH_LOOKBACK_DAYS = 90;

interface RawConversion {
  kind: ConversionRow['kind'];
  source: string;
  first_source: string | null;
  value_cents: number;
  occurred_at: string;
  customer_id: string | null;
  lead_id: string | null;
  anonymous_id: string | null;
  invoice_id: string | null;
}

/** Gross profit per invoice from its work order's line items (price − unit cost). */
export async function loadInvoiceProfits(db: Db, invoiceIds: readonly string[]): Promise<Map<string, number>> {
  const profits = new Map<string, number>();
  for (const ids of chunks([...new Set(invoiceIds)])) {
    const { data: invoices, error } = await db.from('invoices').select('id, work_order_id').in('id', ids);
    if (error) throw new Error(`invoice profit query failed: ${error.message}`);
    const byOrder = new Map((invoices ?? []).map((i) => [i.work_order_id, i.id]));
    if (!byOrder.size) continue;
    const { data: lines, error: lineError } = await db.from('line_items').select('work_order_id, quantity, unit_price_cents, unit_cost_cents, approval').in('work_order_id', [...byOrder.keys()]);
    if (lineError) throw new Error(`line item query failed: ${lineError.message}`);
    const grouped = new Map<string, CostedLine[]>();
    for (const line of lines ?? []) grouped.set(line.work_order_id, [...(grouped.get(line.work_order_id) ?? []), line]);
    for (const [orderId, invoiceId] of byOrder) profits.set(invoiceId, grossProfitCents(grouped.get(orderId) ?? []));
  }
  return profits;
}

async function loadTouchHistory(db: Db, conversions: readonly RawConversion[], from: Date, to: Date): Promise<Map<string, TouchPoint[]>> {
  const since = new Date(from.getTime() - TOUCH_LOOKBACK_DAYS * DAY_MS).toISOString();
  const touches = await allRows(
    (a, b) => db.from('attribution_touches').select('source, occurred_at, customer_id, lead_id, anonymous_id').gte('occurred_at', since).lte('occurred_at', to.toISOString()).order('occurred_at').range(a, b),
    'touch',
  );
  const byKey = new Map<string, TouchPoint[]>();
  const push = (key: string | null, touch: TouchPoint) => {
    if (key) byKey.set(key, [...(byKey.get(key) ?? []), touch]);
  };
  for (const t of touches) {
    const point = { source: t.source, at: t.occurred_at };
    push(t.customer_id && `c:${t.customer_id}`, point);
    push(t.lead_id && `l:${t.lead_id}`, point);
    push(t.anonymous_id && `a:${t.anonymous_id}`, point);
  }
  const result = new Map<string, TouchPoint[]>();
  conversions.forEach((c, index) => {
    const keys = [c.customer_id && `c:${c.customer_id}`, c.lead_id && `l:${c.lead_id}`, c.anonymous_id && `a:${c.anonymous_id}`].filter((k): k is string => Boolean(k));
    const seen = new Set<string>();
    const list = keys.flatMap((k) => byKey.get(k) ?? [])
      .filter((t) => Date.parse(t.at) <= Date.parse(c.occurred_at))
      .filter((t) => {
        const id = `${t.at}|${t.source}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
    if (list.length) result.set(String(index), list);
  });
  return result;
}

/** Source → lead → booked → paid revenue with CPL, ROAS and gross-profit ROAS, for the marketing dashboard. */
export async function getMarketingFunnel(
  options: { from?: Date; to?: Date; model?: AttributionModel } = {},
  db: Db = createAdminClient(),
): Promise<FunnelReport> {
  const to = options.to ?? new Date();
  const from = options.from ?? new Date(to.getTime() - 90 * DAY_MS);
  const model = options.model ?? 'last';
  const [raw, spend] = await Promise.all([
    allRows<RawConversion>(
      (a, b) => db.from('conversion_events').select('kind, source, first_source, value_cents, occurred_at, customer_id, lead_id, anonymous_id, invoice_id').gte('occurred_at', from.toISOString()).lte('occurred_at', to.toISOString()).order('occurred_at').range(a, b),
      'funnel',
    ),
    loadAdSpend(db, from, to),
  ]);
  const [profits, touches] = await Promise.all([
    loadInvoiceProfits(db, raw.flatMap((c) => (c.kind === 'job_paid' && c.invoice_id ? [c.invoice_id] : []))).catch((error: unknown) => {
      console.error(`[marketing] profit lookup failed: ${error instanceof Error ? error.message : String(error)}`);
      return new Map<string, number>();
    }),
    MULTI_TOUCH.includes(model) ? loadTouchHistory(db, raw, from, to) : Promise.resolve(new Map<string, TouchPoint[]>()),
  ]);
  const conversions: ConversionRow[] = raw.map((c, index) => ({
    kind: c.kind, source: c.source, first_source: c.first_source, value_cents: c.value_cents, occurred_at: c.occurred_at,
    profit_cents: c.invoice_id ? (profits.get(c.invoice_id) ?? null) : null,
    touches: touches.get(String(index)),
  }));
  const rows = rollupFunnel(conversions, spend.rows, model);
  return { from: from.toISOString(), to: to.toISOString(), model, rows, totals: funnelTotals(rows), hasSpendData: spend.available };
}

/** Daily leads, bookings, paid revenue and ad spend (shop time zone), zero-filled. */
export async function getDailyStats(db: Db, from: Date, to: Date): Promise<DayStat[]> {
  const [conversions, spend] = await Promise.all([
    allRows(
      (a, b) => db.from('conversion_events').select('kind, value_cents, occurred_at').in('kind', ['lead', 'booking', 'job_paid']).gte('occurred_at', from.toISOString()).lte('occurred_at', to.toISOString()).order('occurred_at').range(a, b),
      'daily conversions',
    ),
    db.from('ad_metrics_daily').select('date, spend_cents').gte('date', dayKey(from)).lte('date', dayKey(to)),
  ]);
  return dailySeries(conversions, spend.error ? [] : (spend.data ?? []), from, to);
}

/** Per-variant delivery, click, conversion and revenue numbers for one campaign. */
export async function getCampaignReport(campaignId: string, db: Db = createAdminClient()): Promise<CampaignVariantReport[]> {
  const { data, error } = await db.from('campaign_sends').select('variant, status, opened_at, clicked_at, converted_at, revenue_cents').eq('campaign_id', campaignId);
  if (error) throw new Error(`campaign report failed: ${error.message}`);
  return campaignReport(data ?? []);
}

export interface CompliancePulse {
  optOuts30d: number;
  suppressed: number;
  smsMarketingConsented: number;
  emailSubscribed: number;
}

/** Headline consent numbers for the dashboard. */
export async function getCompliancePulse(db: Db = createAdminClient(), now = new Date()): Promise<CompliancePulse> {
  const since = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const [optOuts, suppressed, sms, email] = await Promise.all([
    db.from('contact_consent_events').select('id', { count: 'exact', head: true }).eq('action', 'revoked').gte('created_at', since),
    db.from('suppressions').select('id', { count: 'exact', head: true }),
    db.from('customers').select('id', { count: 'exact', head: true }).not('sms_marketing_consent_at', 'is', null).is('sms_marketing_opted_out_at', null).is('sms_opted_out_at', null),
    db.from('customers').select('id', { count: 'exact', head: true }).eq('email_marketing_status', 'subscribed').not('email', 'is', null),
  ]);
  return { optOuts30d: optOuts.count ?? 0, suppressed: suppressed.count ?? 0, smsMarketingConsented: sms.count ?? 0, emailSubscribed: email.count ?? 0 };
}

/* ─── Reports ────────────────────────────────────────────────────────────── */

async function loadPaidInvoices(db: Db): Promise<PaidInvoice[]> {
  const rows = await allRows((a, b) => db.from('invoices').select('customer_id, total_cents, paid_at').eq('status', 'paid').not('paid_at', 'is', null).order('paid_at').range(a, b), 'paid invoices');
  return rows.flatMap((r) => (r.paid_at ? [{ customer_id: r.customer_id, total_cents: r.total_cents, paid_at: r.paid_at }] : []));
}

/** Lifetime paid revenue per customer, grouped by first-touch source (legacy `source` when untracked). */
export async function getLtvBySource(db: Db = createAdminClient()): Promise<LtvRow[]> {
  const [customers, invoices] = await Promise.all([
    allRows((a, b) => db.from('customers').select('id, first_touch_source, source').order('created_at').range(a, b), 'customers'),
    loadPaidInvoices(db),
  ]);
  return ltvBySource(customers.map((c) => ({ id: c.id, source: c.first_touch_source ?? normalizeSourceName(c.source) })), invoices);
}

/** Lead → first reply time vs booking, for leads created in the window. */
export async function getSpeedToLead(db: Db, from: Date, to: Date): Promise<SpeedReport> {
  const [leads, outbound, appointments] = await Promise.all([
    allRows((a, b) => db.from('leads').select('created_at, contacted_at, phone, email, status, customer_id').gte('created_at', from.toISOString()).lte('created_at', to.toISOString()).order('created_at').range(a, b), 'leads'),
    allRows((a, b) => db.from('messages').select('to_address, created_at').eq('direction', 'outbound').in('status', ['sent', 'simulated']).gte('created_at', from.toISOString()).order('created_at').range(a, b), 'messages'),
    allRows((a, b) => db.from('appointments').select('customer_id, created_at').gte('created_at', from.toISOString()).neq('status', 'cancelled').order('created_at').range(a, b), 'appointments'),
  ]);
  return speedToLead(leads.map((lead) => ({
    created_at: lead.created_at,
    first_response_at: firstResponseAt(lead, outbound),
    booked: lead.status === 'booked' || lead.status === 'won'
      || appointments.some((appt) => lead.customer_id !== null && appt.customer_id === lead.customer_id && appt.created_at >= lead.created_at),
  })));
}

export interface RetentionData {
  retention: RetentionReport;
  cohorts: CohortRow[];
  reminders: { sent: number; booked: number; rate: number | null };
}

export async function getRetention(db: Db, now: Date, cohortMonths = 6): Promise<RetentionData> {
  const since = new Date(now.getTime() - 180 * DAY_MS).toISOString();
  const [invoices, reminders, bookings] = await Promise.all([
    loadPaidInvoices(db),
    allRows((a, b) => db.from('messages').select('customer_id, created_at').eq('automation_key', 'service_due').in('status', ['sent', 'simulated']).gte('created_at', since).order('created_at').range(a, b), 'reminders'),
    allRows((a, b) => db.from('appointments').select('customer_id, created_at').gte('created_at', since).neq('status', 'cancelled').order('created_at').range(a, b), 'bookings'),
  ]);
  return { retention: retentionReport(invoices, now), cohorts: cohortGrid(invoices, now, cohortMonths), reminders: reminderConversion(reminders, bookings) };
}

/** Channel budgets for a month (YYYY-MM) vs ad spend and logged offline spend. */
export async function getBudgetReport(db: Db, month: string, now: Date): Promise<{ inputs: { channel: string; budget_cents: number; manual_spend_cents: number }[]; report: ReturnType<typeof budgetVsActual> }> {
  const monthStart = startOfDayInZone(`${month}-01`);
  const nextMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 7);
  const monthEnd = new Date(startOfDayInZone(`${nextMonth}-01`).getTime() - 1);
  const [{ data: inputs, error }, spend] = await Promise.all([
    db.from('marketing_budgets').select('channel, budget_cents, manual_spend_cents').eq('month', `${month}-01`),
    loadAdSpend(db, monthStart, monthEnd < now ? monthEnd : now),
  ]);
  if (error) throw new Error(`budget query failed: ${error.message}`);
  const elapsed = now >= monthEnd ? 1 : now < monthStart ? 0 : monthElapsed(now);
  return { inputs: inputs ?? [], report: budgetVsActual(inputs ?? [], spend.rows, elapsed) };
}

export async function getGoals(db: Db, month: string): Promise<{ metric: string; target: number }[]> {
  const { data, error } = await db.from('marketing_goals').select('metric, target').eq('month', `${month}-01`);
  if (error) throw new Error(`goals query failed: ${error.message}`);
  return data ?? [];
}

export async function getCallReport(db: Db, from: Date): Promise<{ rows: CallRow[]; numbers: { id: string; phone: string; source: string; label: string }[] }> {
  const [calls, { data: numbers, error }] = await Promise.all([
    allRows((a, b) => db.from('marketing_call_events').select('to_number, call_status, customer_id, texted_back_at').gte('created_at', from.toISOString()).order('created_at').range(a, b), 'calls'),
    db.from('marketing_tracking_numbers').select('id, phone, source, label').order('created_at'),
  ]);
  if (error) throw new Error(`tracking numbers query failed: ${error.message}`);
  return { rows: callAttribution(calls, numbers ?? []), numbers: numbers ?? [] };
}
