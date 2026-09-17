/** Pure attribution rollups for the marketing dashboard and reports. */

export type AttributionModel = 'first' | 'last' | 'linear' | 'time_decay' | 'position';

export const ATTRIBUTION_MODELS: readonly { value: AttributionModel; label: string; hint: string }[] = [
  { value: 'first', label: 'First', hint: 'All credit to the first touch' },
  { value: 'last', label: 'Last', hint: 'All credit to the last touch' },
  { value: 'linear', label: 'Linear', hint: 'Equal credit to every touch' },
  { value: 'time_decay', label: 'Decay', hint: 'Recent touches count more' },
  { value: 'position', label: 'U-shape', hint: '40% first, 40% last, 20% middle' },
];

export function parseAttributionModel(raw: unknown): AttributionModel {
  return ATTRIBUTION_MODELS.some((m) => m.value === raw) ? (raw as AttributionModel) : 'last';
}

export interface TouchPoint {
  source: string;
  at: string;
}

export interface ConversionRow {
  kind: 'lead' | 'booking' | 'job_paid' | 'store_checkout_click';
  source: string;
  first_source: string | null;
  value_cents: number;
  /** Gross profit on a paid job (price − line-item cost); null when unknown. */
  profit_cents?: number | null;
  /** Chronological touches before the conversion; used by multi-touch models. */
  touches?: readonly TouchPoint[];
  occurred_at?: string;
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
  /** Gross profit on paid jobs (revenue − line-item cost). */
  profitCents: number;
  spendCents: number;
  /** null when there is no spend or no leads. */
  costPerLeadCents: number | null;
  costPerBookingCents: number | null;
  /** Revenue ÷ spend; null without spend. */
  roas: number | null;
  /** Gross profit ÷ spend; null without spend. */
  profitRoas: number | null;
  leadToBookingRate: number | null;
  bookingToPaidRate: number | null;
}

/** Ad platforms report spend by platform; map to the touch source we attribute to. */
export const SPEND_SOURCE_BY_PLATFORM: Record<string, string> = { meta: 'facebook', facebook: 'facebook', instagram: 'instagram', google: 'google', lsa: 'google', tiktok: 'tiktok', bing: 'bing' };

const DAY_MS = 86_400_000;
/** Time-decay half-life: a touch a week older gets half the credit. */
export const DECAY_HALF_LIFE_DAYS = 7;

const ratio = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 1000) / 1000 : null);
const perUnit = (spend: number, units: number): number | null => (spend > 0 && units > 0 ? Math.round(spend / units) : null);
const round2 = (value: number): number => Math.round(value * 100) / 100;

function emptyRow(source: string): FunnelRow {
  return { source, leads: 0, bookings: 0, paidJobs: 0, checkoutClicks: 0, revenueCents: 0, profitCents: 0, spendCents: 0, costPerLeadCents: null, costPerBookingCents: null, roas: null, profitRoas: null, leadToBookingRate: null, bookingToPaidRate: null };
}

function finish(row: FunnelRow): FunnelRow {
  return {
    ...row,
    leads: round2(row.leads),
    bookings: round2(row.bookings),
    paidJobs: round2(row.paidJobs),
    checkoutClicks: round2(row.checkoutClicks),
    revenueCents: Math.round(row.revenueCents),
    profitCents: Math.round(row.profitCents),
    costPerLeadCents: perUnit(row.spendCents, row.leads),
    costPerBookingCents: perUnit(row.spendCents, row.bookings),
    roas: row.spendCents > 0 ? round2(row.revenueCents / row.spendCents) : null,
    profitRoas: row.spendCents > 0 ? round2(row.profitCents / row.spendCents) : null,
    leadToBookingRate: ratio(row.bookings, row.leads),
    bookingToPaidRate: ratio(row.paidJobs, row.bookings),
  };
}

/**
 * Splits one conversion's credit across its touches. Weights sum to 1.
 * position: 40% first, 40% last, 20% shared by the middle (50/50 with two touches).
 */
export function touchCredits(touches: readonly TouchPoint[], model: AttributionModel, occurredAt?: string): Map<string, number> {
  const credit = new Map<string, number>();
  if (!touches.length) return credit;
  const add = (source: string, weight: number) => credit.set(source || 'direct', (credit.get(source || 'direct') ?? 0) + weight);
  const n = touches.length;
  if (model === 'first' || n === 1) {
    add((model === 'last' ? touches[n - 1]! : touches[0]!).source, 1);
    return credit;
  }
  if (model === 'last') {
    add(touches[n - 1]!.source, 1);
    return credit;
  }
  if (model === 'linear') {
    for (const t of touches) add(t.source, 1 / n);
    return credit;
  }
  if (model === 'position') {
    if (n === 2) {
      add(touches[0]!.source, 0.5);
      add(touches[1]!.source, 0.5);
      return credit;
    }
    add(touches[0]!.source, 0.4);
    add(touches[n - 1]!.source, 0.4);
    for (const t of touches.slice(1, -1)) add(t.source, 0.2 / (n - 2));
    return credit;
  }
  const end = Date.parse(occurredAt ?? touches[n - 1]!.at);
  const weights = touches.map((t) => 0.5 ** (Math.max(0, end - Date.parse(t.at)) / DAY_MS / DECAY_HALF_LIFE_DAYS));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  touches.forEach((t, i) => add(t.source, weights[i]! / sum));
  return credit;
}

/** Stored first/last sources stand in when a conversion has no touch history. */
function conversionCredits(c: ConversionRow, model: AttributionModel): Map<string, number> {
  if (model === 'first') return new Map([[c.first_source ?? c.source, 1]]);
  if (model === 'last') return new Map([[c.source, 1]]);
  const touches = c.touches?.length
    ? c.touches
    : c.first_source && c.first_source !== c.source
      ? [{ source: c.first_source, at: c.occurred_at ?? '' }, { source: c.source, at: c.occurred_at ?? '' }]
      : [{ source: c.source, at: c.occurred_at ?? '' }];
  return touchCredits(touches, model, c.occurred_at);
}

/** Source → lead → booked → paid revenue, one row per source, highest revenue first. Multi-touch models give fractional counts. */
export function rollupFunnel(conversions: readonly ConversionRow[], spend: readonly SpendRow[], model: AttributionModel = 'last'): FunnelRow[] {
  const rows = new Map<string, FunnelRow>();
  const row = (source: string) => {
    const key = source || 'direct';
    if (!rows.has(key)) rows.set(key, emptyRow(key));
    return rows.get(key)!;
  };
  for (const c of conversions) {
    for (const [source, weight] of conversionCredits(c, model)) {
      const r = row(source);
      if (c.kind === 'lead') r.leads += weight;
      if (c.kind === 'booking') r.bookings += weight;
      if (c.kind === 'store_checkout_click') r.checkoutClicks += weight;
      if (c.kind === 'job_paid') {
        r.paidJobs += weight;
        r.revenueCents += Math.max(0, c.value_cents) * weight;
        r.profitCents += (c.profit_cents ?? Math.max(0, c.value_cents)) * weight;
      }
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
    profitCents: acc.profitCents + r.profitCents,
    spendCents: acc.spendCents + r.spendCents,
  }), emptyRow('total'));
  return finish(total);
}

export interface CostedLine {
  quantity: number | string;
  unit_price_cents: number;
  unit_cost_cents: number | null;
  approval: string;
}

/** Gross profit of a job: price − known cost over lines not declined. Lines without a cost (labor) count as full margin. */
export function grossProfitCents(lines: readonly CostedLine[]): number {
  return lines
    .filter((l) => l.approval !== 'declined')
    .reduce((sum, l) => sum + Math.round(Number(l.quantity) * (l.unit_price_cents - (l.unit_cost_cents ?? 0))), 0);
}

/** Calendar day (YYYY-MM-DD) of an instant in the shop's time zone. */
export function dayKey(at: string | Date, timeZone = 'America/New_York'): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(typeof at === 'string' ? new Date(at) : at);
}

export interface DayStat {
  date: string;
  leads: number;
  bookings: number;
  paidJobs: number;
  revenueCents: number;
  spendCents: number;
}

/** One row per day from `from` to `to` inclusive (shop time zone), zero-filled. */
export function dailySeries(
  conversions: readonly { kind: string; value_cents: number; occurred_at: string }[],
  spend: readonly { date: string; spend_cents: number }[],
  from: Date,
  to: Date,
  timeZone = 'America/New_York',
): DayStat[] {
  const days = new Map<string, DayStat>();
  for (let t = from.getTime(); t <= to.getTime() + DAY_MS / 2; t += DAY_MS) {
    const key = dayKey(new Date(t), timeZone);
    if (!days.has(key)) days.set(key, { date: key, leads: 0, bookings: 0, paidJobs: 0, revenueCents: 0, spendCents: 0 });
  }
  for (const c of conversions) {
    const d = days.get(dayKey(c.occurred_at, timeZone));
    if (!d) continue;
    if (c.kind === 'lead') d.leads += 1;
    if (c.kind === 'booking') d.bookings += 1;
    if (c.kind === 'job_paid') {
      d.paidJobs += 1;
      d.revenueCents += Math.max(0, c.value_cents);
    }
  }
  for (const s of spend) {
    const d = days.get(s.date);
    if (d) d.spendCents += Math.max(0, s.spend_cents);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
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

/** The UTC instant of 00:00 on a calendar day (YYYY-MM-DD) in a time zone. */
export function startOfDayInZone(day: string, timeZone = 'America/New_York'): Date {
  const guess = Date.parse(`${day}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', day: 'numeric', hourCycle: 'h23', timeZone }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const localDay = get('day');
  const minutes = get('hour') * 60 + get('minute');
  // Local clock at UTC midnight; west of UTC this falls on the previous day.
  const offsetMinutes = localDay === Number(day.slice(8, 10)) ? minutes : minutes - 24 * 60;
  return new Date(guess - offsetMinutes * 60_000);
}
