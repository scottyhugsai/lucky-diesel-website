import 'server-only';
import { adminDb, type Db } from '@/lib/marketing/content/db';

export interface Totals {
  spendCents: number;
  impressions: number;
  clicks: number;
  leads: number;
  bookings: number;
  revenueCents: number;
}

export interface PerfRow extends Totals {
  id: string;
  name: string;
  detail: string;
  simulated: boolean;
}

export interface DayPoint {
  date: string;
  spendCents: number;
  leads: number;
}

export interface PerformanceData {
  totals: Totals & { simulated: boolean };
  days: DayPoint[];
  campaigns: PerfRow[];
  creatives: PerfRow[];
  autoPauses: { name: string; reason: string; at: string }[];
}

const ZERO: Totals = { spendCents: 0, impressions: 0, clicks: 0, leads: 0, bookings: 0, revenueCents: 0 };

interface MetricRow {
  publication_id: string;
  date: string;
  impressions: number;
  clicks: number;
  spend_cents: number;
  leads: number;
  conversions: number;
  conversion_value_cents: number;
  simulated: boolean;
}

function add(t: Totals, m: MetricRow): Totals {
  return {
    spendCents: t.spendCents + m.spend_cents, impressions: t.impressions + m.impressions, clicks: t.clicks + m.clicks,
    leads: t.leads + m.leads, bookings: t.bookings + m.conversions, revenueCents: t.revenueCents + m.conversion_value_cents,
  };
}

/** Rolls ad metrics up per campaign, per creative and per day. Simulated rows stay flagged. */
export async function loadPerformance(days = 30, db: Db = adminDb()): Promise<PerformanceData> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const [{ data: metrics }, { data: pubs }, { data: campaigns }] = await Promise.all([
    db.from('ad_metrics_daily').select('publication_id, date, impressions, clicks, spend_cents, leads, conversions, conversion_value_cents, simulated').gte('date', since).order('date'),
    db.from('ad_publications').select('id, campaign_id, variant_id'),
    db.from('ad_campaigns').select('id, name, platform, status, notes, updated_at'),
  ]);
  const variantIds = [...new Set((pubs ?? []).map((p) => p.variant_id))];
  const { data: variants } = variantIds.length
    ? await db.from('ad_creative_variants').select('id, label, creative_id, ad_creatives(name, platform)').in('id', variantIds)
    : { data: [] };

  const pubById = new Map((pubs ?? []).map((p) => [p.id, p]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));
  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c]));

  const byCampaign = new Map<string, PerfRow>();
  const byCreative = new Map<string, PerfRow>();
  const byDay = new Map<string, DayPoint>();
  let totals = ZERO;
  let simulated = false;

  for (const m of (metrics ?? []) as MetricRow[]) {
    totals = add(totals, m);
    simulated ||= m.simulated;
    const day = byDay.get(m.date) ?? { date: m.date, spendCents: 0, leads: 0 };
    byDay.set(m.date, { ...day, spendCents: day.spendCents + m.spend_cents, leads: day.leads + m.leads });

    const pub = pubById.get(m.publication_id);
    const campaign = pub?.campaign_id ? campaignById.get(pub.campaign_id) : undefined;
    if (campaign) {
      const row = byCampaign.get(campaign.id) ?? { id: campaign.id, name: campaign.name, detail: `${campaign.platform} · ${campaign.status}`, simulated: false, ...ZERO };
      byCampaign.set(campaign.id, { ...row, ...add(row, m), simulated: row.simulated || m.simulated });
    }
    const variant = pub ? variantById.get(pub.variant_id) : undefined;
    if (variant) {
      const key = variant.creative_id;
      const row = byCreative.get(key) ?? { id: key, name: variant.ad_creatives?.name ?? 'Ad', detail: variant.ad_creatives?.platform ?? '', simulated: false, ...ZERO };
      byCreative.set(key, { ...row, ...add(row, m), simulated: row.simulated || m.simulated });
    }
  }

  const bySpend = (a: PerfRow, b: PerfRow) => b.spendCents - a.spendCents;
  return {
    totals: { ...totals, simulated },
    days: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    campaigns: [...byCampaign.values()].sort(bySpend),
    creatives: [...byCreative.values()].sort(bySpend),
    autoPauses: (campaigns ?? [])
      .filter((c) => c.status === 'paused' && c.notes?.startsWith('Paused:') && c.notes !== 'Paused: owner paused')
      .map((c) => ({ name: c.name, reason: c.notes!.replace(/^Paused:\s*/, ''), at: c.updated_at })),
  };
}

export function costPerLead(row: Totals): number | null {
  return row.leads ? Math.round(row.spendCents / row.leads) : null;
}

export function roas(row: Totals): number | null {
  return row.spendCents ? row.revenueCents / row.spendCents : null;
}
