/** Pure attribution rollups for the marketing dashboard. */

export type AttributionModel = 'first' | 'last';

export interface ConversionRow {
  kind: 'lead' | 'booking' | 'job_paid' | 'store_checkout_click';
  source: string;
  first_source: string | null;
  value_cents: number;
}

export interface SpendRow {
  source: string;
  spend_cents: number;
}

export interface FunnelRow {
  source: string;
  leads: number;
  bookings: number;
  paidJobs: number;
  checkoutClicks: number;
  revenueCents: number;
  spendCents: number;
  /** null when there is no spend or no leads. */
  costPerLeadCents: number | null;
  costPerBookingCents: number | null;
  /** Revenue ÷ spend; null without spend. */
  roas: number | null;
  leadToBookingRate: number | null;
  bookingToPaidRate: number | null;
}

/** Ad platforms report spend by platform; map to the touch source we attribute to. */
export const SPEND_SOURCE_BY_PLATFORM: Record<string, string> = { meta: 'facebook', facebook: 'facebook', instagram: 'instagram', google: 'google', lsa: 'google', tiktok: 'tiktok', bing: 'bing' };

const ratio = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 1000) / 1000 : null);
const perUnit = (spend: number, units: number): number | null => (spend > 0 && units > 0 ? Math.round(spend / units) : null);

function emptyRow(source: string): FunnelRow {
  return { source, leads: 0, bookings: 0, paidJobs: 0, checkoutClicks: 0, revenueCents: 0, spendCents: 0, costPerLeadCents: null, costPerBookingCents: null, roas: null, leadToBookingRate: null, bookingToPaidRate: null };
}

function finish(row: FunnelRow): FunnelRow {
  return {
    ...row,
    costPerLeadCents: perUnit(row.spendCents, row.leads),
    costPerBookingCents: perUnit(row.spendCents, row.bookings),
    roas: row.spendCents > 0 ? Math.round((row.revenueCents / row.spendCents) * 100) / 100 : null,
    leadToBookingRate: ratio(row.bookings, row.leads),
    bookingToPaidRate: ratio(row.paidJobs, row.bookings),
  };
}

/** Source → lead → booked → paid revenue, one row per source, highest revenue first. */
export function rollupFunnel(conversions: readonly ConversionRow[], spend: readonly SpendRow[], model: AttributionModel = 'last'): FunnelRow[] {
  const rows = new Map<string, FunnelRow>();
  const row = (source: string) => {
    const key = source || 'direct';
    if (!rows.has(key)) rows.set(key, emptyRow(key));
    return rows.get(key)!;
  };
  for (const c of conversions) {
    const r = row(model === 'first' ? (c.first_source ?? c.source) : c.source);
    if (c.kind === 'lead') r.leads += 1;
    if (c.kind === 'booking') r.bookings += 1;
    if (c.kind === 'store_checkout_click') r.checkoutClicks += 1;
    if (c.kind === 'job_paid') {
      r.paidJobs += 1;
      r.revenueCents += Math.max(0, c.value_cents);
    }
  }
  for (const s of spend) row(s.source).spendCents += Math.max(0, s.spend_cents);
  return [...rows.values()].map(finish).sort((a, b) => b.revenueCents - a.revenueCents || b.leads - a.leads || a.source.localeCompare(b.source));
}

export function funnelTotals(rows: readonly FunnelRow[]): FunnelRow {
  const total = rows.reduce((acc, r) => ({
    ...acc,
    leads: acc.leads + r.leads,
    bookings: acc.bookings + r.bookings,
    paidJobs: acc.paidJobs + r.paidJobs,
    checkoutClicks: acc.checkoutClicks + r.checkoutClicks,
    revenueCents: acc.revenueCents + r.revenueCents,
    spendCents: acc.spendCents + r.spendCents,
  }), emptyRow('total'));
  return finish(total);
}

export interface SendRow {
  variant: string | null;
  status: string;
  opened_at: string | null;
  clicked_at: string | null;
  converted_at: string | null;
  revenue_cents: number;
}

export interface CampaignVariantReport {
  variant: string;
  scheduled: number;
  delivered: number;
  skipped: number;
  failed: number;
  opened: number;
  clicked: number;
  converted: number;
  revenueCents: number;
  clickRate: number | null;
}

export function campaignReport(sends: readonly SendRow[]): CampaignVariantReport[] {
  const byVariant = new Map<string, CampaignVariantReport>();
  for (const s of sends) {
    const key = s.variant ?? 'pending';
    const r = byVariant.get(key) ?? { variant: key, scheduled: 0, delivered: 0, skipped: 0, failed: 0, opened: 0, clicked: 0, converted: 0, revenueCents: 0, clickRate: null };
    if (s.status === 'scheduled') r.scheduled += 1;
    if (s.status === 'sent' || s.status === 'simulated') r.delivered += 1;
    if (s.status === 'skipped' || s.status === 'cancelled') r.skipped += 1;
    if (s.status === 'failed') r.failed += 1;
    if (s.opened_at) r.opened += 1;
    if (s.clicked_at) r.clicked += 1;
    if (s.converted_at) r.converted += 1;
    r.revenueCents += s.revenue_cents;
    byVariant.set(key, r);
  }
  return [...byVariant.values()].map((r) => ({ ...r, clickRate: ratio(r.clicked, r.delivered) })).sort((a, b) => a.variant.localeCompare(b.variant));
}
