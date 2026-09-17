import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { campaignReport, funnelTotals, rollupFunnel, SPEND_SOURCE_BY_PLATFORM, type AttributionModel, type CampaignVariantReport, type FunnelRow, type SpendRow } from './analytics-math';
import type { Db } from './settings';

export type { AttributionModel, CampaignVariantReport, FunnelRow } from './analytics-math';

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

/** Source → lead → booked → paid revenue with CPL/ROAS, for the marketing dashboard. */
export async function getMarketingFunnel(
  options: { from?: Date; to?: Date; model?: AttributionModel } = {},
  db: Db = createAdminClient(),
): Promise<FunnelReport> {
  const to = options.to ?? new Date();
  const from = options.from ?? new Date(to.getTime() - 90 * DAY_MS);
  const model = options.model ?? 'last';
  const [{ data: conversions, error }, spend] = await Promise.all([
    db.from('conversion_events').select('kind, source, first_source, value_cents').gte('occurred_at', from.toISOString()).lte('occurred_at', to.toISOString()),
    loadAdSpend(db, from, to),
  ]);
  if (error) throw new Error(`funnel query failed: ${error.message}`);
  const rows = rollupFunnel(conversions ?? [], spend.rows, model);
  return { from: from.toISOString(), to: to.toISOString(), model, rows, totals: funnelTotals(rows), hasSpendData: spend.available };
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
