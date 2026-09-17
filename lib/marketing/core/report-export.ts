import 'server-only';
import { allRows, getDailyStats, getMarketingFunnel } from './analytics';
import { parseAttributionModel } from './analytics-math';
import { dollars } from './csv';
import type { Db } from './settings';

/** Row builders shared by the admin CSV downloads and the read-only report feed. */

export const REPORT_KINDS = ['funnel', 'daily', 'campaigns'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export function parseReportKind(raw: unknown): ReportKind | null {
  return (REPORT_KINDS as readonly string[]).includes(raw as string) ? (raw as ReportKind) : null;
}

export interface ReportTable {
  headers: string[];
  rows: Record<string, unknown>[];
}

async function funnelTable(db: Db, from: Date, to: Date, model: unknown): Promise<ReportTable> {
  const funnel = await getMarketingFunnel({ from, to, model: parseAttributionModel(model) }, db);
  return {
    headers: ['source', 'leads', 'bookings', 'paid_jobs', 'revenue', 'gross_profit', 'ad_spend', 'cost_per_lead', 'cost_per_booking', 'roas', 'profit_roas'],
    rows: funnel.rows.map((r) => ({
      source: r.source, leads: r.leads, bookings: r.bookings, paid_jobs: r.paidJobs,
      revenue: dollars(r.revenueCents), gross_profit: dollars(r.profitCents), ad_spend: dollars(r.spendCents),
      cost_per_lead: r.costPerLeadCents === null ? '' : dollars(r.costPerLeadCents),
      cost_per_booking: r.costPerBookingCents === null ? '' : dollars(r.costPerBookingCents),
      roas: r.roas ?? '', profit_roas: r.profitRoas ?? '',
    })),
  };
}

async function dailyTable(db: Db, from: Date, to: Date): Promise<ReportTable> {
  const days = await getDailyStats(db, from, to);
  return {
    headers: ['date', 'leads', 'bookings', 'paid_jobs', 'revenue', 'ad_spend'],
    rows: days.map((d) => ({ date: d.date, leads: d.leads, bookings: d.bookings, paid_jobs: d.paidJobs, revenue: dollars(d.revenueCents), ad_spend: dollars(d.spendCents) })),
  };
}

interface CampaignTotals {
  sent: number;
  clicked: number;
  converted: number;
  revenueCents: number;
}

async function campaignTable(db: Db, from: Date): Promise<ReportTable> {
  const [campaigns, sends] = await Promise.all([
    allRows((a, b) => db.from('campaigns').select('id, name, kind, channel, status, scheduled_at, created_at').gte('created_at', from.toISOString()).order('created_at').range(a, b), 'campaigns'),
    allRows((a, b) => db.from('campaign_sends').select('campaign_id, status, clicked_at, converted_at, revenue_cents').range(a, b), 'campaign sends'),
  ]);
  const totals = new Map<string, CampaignTotals>();
  for (const s of sends) {
    const t = totals.get(s.campaign_id) ?? { sent: 0, clicked: 0, converted: 0, revenueCents: 0 };
    if (s.status === 'sent' || s.status === 'simulated') t.sent += 1;
    if (s.clicked_at) t.clicked += 1;
    if (s.converted_at) t.converted += 1;
    t.revenueCents += s.revenue_cents;
    totals.set(s.campaign_id, t);
  }
  return {
    headers: ['campaign', 'kind', 'channel', 'status', 'scheduled_at', 'sent', 'clicked', 'converted', 'revenue'],
    rows: campaigns.map((c) => {
      const t = totals.get(c.id) ?? { sent: 0, clicked: 0, converted: 0, revenueCents: 0 };
      return { campaign: c.name, kind: c.kind, channel: c.channel, status: c.status, scheduled_at: c.scheduled_at ?? '', sent: t.sent, clicked: t.clicked, converted: t.converted, revenue: dollars(t.revenueCents) };
    }),
  };
}

/** Aggregate marketing numbers only — never contact rows. */
export async function buildReportTable(db: Db, kind: ReportKind, from: Date, to: Date, model?: unknown): Promise<ReportTable> {
  if (kind === 'funnel') return funnelTable(db, from, to, model);
  if (kind === 'daily') return dailyTable(db, from, to);
  return campaignTable(db, from);
}
