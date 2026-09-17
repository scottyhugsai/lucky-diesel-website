import 'server-only';
import { siteUrl } from '@/lib/site-url';
import { evaluateAdAlerts, type MetricDay } from './ad-alerts';
import { ownerContact, sendContentMessage } from './alerts';
import { pacing, shouldPauseForCpl } from './budget';
import { demoAdAdapter } from './channels/demo';
import { adAdapterFor } from './channels/registry';
import { adminDb, isCampaignPlatform, loadGuards, type Db } from './db';
import { pauseCampaign } from './publish-service';

export interface SyncSummary {
  campaigns: number;
  rows: number;
  simulatedRows: number;
  paused: { campaignId: string; reason: string }[];
  alerts: number;
  errors: string[];
}

function yesterday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(Date.now() - 86_400_000));
}

/**
 * Daily: pulls insights for every live campaign (simulated in demo mode, and
 * flagged so), then enforces pacing and cost-per-lead auto-pause.
 */
export async function syncAdMetrics(date: string = yesterday(), db: Db = adminDb()): Promise<SyncSummary> {
  const summary: SyncSummary = { campaigns: 0, rows: 0, simulatedRows: 0, paused: [], alerts: 0, errors: [] };
  const { data: campaigns } = await db.from('ad_campaigns').select('*, ad_publications(*)').eq('status', 'live');
  const guards = await loadGuards(db);

  for (const campaign of campaigns ?? []) {
    if (!isCampaignPlatform(campaign.platform) || !campaign.ad_publications.length) continue;
    // Nothing can have been spent outside the campaign's dates.
    if ((campaign.starts_on && date < campaign.starts_on) || (campaign.ends_on && date > campaign.ends_on)) continue;
    summary.campaigns += 1;
    try {
      const { adapter } = await adAdapterFor(campaign.platform, db);
      const publications = [...campaign.ad_publications].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const share = Math.round(campaign.daily_budget_cents / publications.length);
      const liveCampaignLevelDone = new Set<string>();
      for (const publication of publications) {
        const ids = (publication.external_ids ?? {}) as Record<string, string>;
        // Live platforms report per campaign: store it once, on the first publication.
        if (!publication.simulated && liveCampaignLevelDone.has(ids.campaign ?? '')) continue;
        liveCampaignLevelDone.add(ids.campaign ?? '');
        const metrics = publication.simulated
          ? await demoAdAdapter(adapter.platform).insights(ids, date, share)
          : await adapter.insights(ids, date, campaign.daily_budget_cents);
        if (!metrics) continue;
        const { error } = await db.from('ad_metrics_daily').upsert({
          publication_id: publication.id, date, impressions: metrics.impressions, clicks: metrics.clicks, spend_cents: metrics.spendCents,
          leads: metrics.leads, conversions: metrics.conversions, conversion_value_cents: metrics.conversionValueCents, simulated: publication.simulated,
        }, { onConflict: 'publication_id,date' });
        if (error) throw new Error(error.message);
        summary.rows += 1;
        if (publication.simulated) summary.simulatedRows += 1;
        await db.from('ad_publications').update({ last_synced_at: new Date().toISOString() }).eq('id', publication.id);
      }

      const reason = await autoPauseReason(db, campaign, guards.find((g) => g.platform === campaign.platform)?.autoPauseCplCents ?? null, guards.find((g) => g.platform === campaign.platform)?.pacingTolerance ?? 1.2, date);
      const simulated = campaign.ad_publications.every((p) => p.simulated);
      if (reason) {
        const paused = await pauseCampaign(campaign.id, reason, db);
        if (paused.ok) {
          summary.paused.push({ campaignId: campaign.id, reason });
          if (await recordAlert(db, { campaignId: campaign.id, name: campaign.name, kind: 'paused', message: reason, date, simulated })) summary.alerts += 1;
        } else summary.errors.push(`${campaign.name}: could not pause (${paused.error})`);
      } else {
        for (const alert of evaluateAdAlerts(await campaignDays(db, campaign.id, date))) {
          if (await recordAlert(db, { campaignId: campaign.id, name: campaign.name, kind: alert.kind, message: alert.message, date, simulated })) summary.alerts += 1;
        }
      }
    } catch (error) {
      summary.errors.push(`${campaign.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (summary.errors.length) console.error(`[marketing/metrics] ${summary.errors.join(' | ')}`);
  return summary;
}

/** One row per day for a campaign, up to `date`, summed across its ads. */
async function campaignDays(db: Db, campaignId: string, date: string): Promise<MetricDay[]> {
  const { data } = await db.from('ad_metrics_daily').select('date, spend_cents, impressions, clicks, leads, ad_publications!inner(campaign_id)').eq('ad_publications.campaign_id', campaignId).lte('date', date).order('date');
  const byDate = new Map<string, MetricDay>();
  for (const r of data ?? []) {
    const d = byDate.get(r.date) ?? { date: r.date, spendCents: 0, impressions: 0, clicks: 0, leads: 0 };
    byDate.set(r.date, { date: r.date, spendCents: d.spendCents + r.spend_cents, impressions: d.impressions + r.impressions, clicks: d.clicks + r.clicks, leads: d.leads + r.leads });
  }
  return [...byDate.values()];
}

/**
 * Stores an alert once per campaign, kind and day, then texts/emails the owner.
 * For demo campaigns only the pause is sent; demo metric alerts just show on Performance.
 */
async function recordAlert(db: Db, alert: { campaignId: string; name: string; kind: 'cpl_spike' | 'zero_leads' | 'fatigue' | 'paused'; message: string; date: string; simulated: boolean }): Promise<boolean> {
  const { data, error } = await db.from('ad_alerts')
    .upsert({ campaign_id: alert.campaignId, kind: alert.kind, alert_date: alert.date, message: alert.message, simulated: alert.simulated }, { onConflict: 'campaign_id,kind,alert_date', ignoreDuplicates: true })
    .select('id');
  if (error || !data?.length) return false;
  if (alert.simulated && alert.kind !== 'paused') return true;
  const key = alert.kind === 'paused' ? 'content_campaign_paused' : 'content_ad_alert';
  const outcome = await sendContentMessage(db, key, await ownerContact(db), { campaign: alert.name, reason: alert.message, alert: alert.message, admin_link: `${siteUrl()}/admin/marketing/ads/performance` });
  await db.from('ad_alerts').update({ sent: outcome.sent > 0 }).eq('id', data[0]!.id);
  return true;
}

export interface AlertView {
  id: string;
  campaign: string;
  kind: string;
  message: string;
  date: string;
  simulated: boolean;
  sent: boolean;
}

export async function recentAdAlerts(limit = 12, db: Db = adminDb()): Promise<AlertView[]> {
  const { data } = await db.from('ad_alerts').select('id, kind, message, alert_date, simulated, sent, ad_campaigns(name)').order('created_at', { ascending: false }).limit(limit);
  return (data ?? []).map((a) => ({ id: a.id, campaign: a.ad_campaigns?.name ?? 'Campaign', kind: a.kind, message: a.message, date: a.alert_date, simulated: a.simulated, sent: a.sent }));
}

async function autoPauseReason(
  db: Db,
  campaign: { id: string; daily_budget_cents: number; starts_on: string | null; ends_on: string | null },
  cplCapCents: number | null,
  tolerance: number,
  today: string,
): Promise<string | null> {
  if (!campaign.starts_on || !campaign.ends_on) return 'campaign has no dates';
  if (today > campaign.ends_on) return 'campaign end date passed';
  const { data } = await db.from('ad_metrics_daily').select('spend_cents, leads, ad_publications!inner(campaign_id)').eq('ad_publications.campaign_id', campaign.id);
  const spend = (data ?? []).reduce((t, r) => t + r.spend_cents, 0);
  const leads = (data ?? []).reduce((t, r) => t + r.leads, 0);
  const pace = pacing({ dailyBudgetCents: campaign.daily_budget_cents, startsOn: campaign.starts_on, endsOn: campaign.ends_on, spentToDateCents: spend, today, tolerance });
  if (pace.shouldPause) {
    if (pace.state === 'not_started') return 'spend recorded before the start date';
    return pace.state === 'exhausted' ? 'lifetime budget spent' : `spend is ${Math.round(pace.ratio * 100)}% of planned pace`;
  }
  if (shouldPauseForCpl(spend, leads, cplCapCents)) return `cost per lead above $${((cplCapCents ?? 0) / 100).toFixed(0)}`;
  return null;
}

export interface CampaignPerformance {
  campaignId: string;
  name: string;
  platform: string;
  status: string;
  simulated: boolean;
  spendCents: number;
  impressions: number;
  clicks: number;
  leads: number;
  costPerLeadCents: number | null;
  daily: { date: string; spendCents: number; clicks: number; leads: number }[];
}

/** Dashboard data: per-campaign totals and daily series over the last `days`. Simulated rows stay flagged. */
export async function campaignPerformance(days = 30, db: Db = adminDb()): Promise<CampaignPerformance[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data: campaigns } = await db.from('ad_campaigns').select('id, name, platform, status, simulated, ad_publications(id, simulated, ad_metrics_daily(date, spend_cents, impressions, clicks, leads))');
  return (campaigns ?? []).map((c) => {
    const rows = c.ad_publications.flatMap((p) => p.ad_metrics_daily.filter((m) => m.date >= since));
    const byDate = new Map<string, { spendCents: number; clicks: number; leads: number }>();
    for (const r of rows) {
      const d = byDate.get(r.date) ?? { spendCents: 0, clicks: 0, leads: 0 };
      byDate.set(r.date, { spendCents: d.spendCents + r.spend_cents, clicks: d.clicks + r.clicks, leads: d.leads + r.leads });
    }
    const spendCents = rows.reduce((t, r) => t + r.spend_cents, 0);
    const leads = rows.reduce((t, r) => t + r.leads, 0);
    return {
      campaignId: c.id, name: c.name, platform: c.platform, status: c.status,
      simulated: c.simulated || c.ad_publications.some((p) => p.simulated),
      spendCents, impressions: rows.reduce((t, r) => t + r.impressions, 0), clicks: rows.reduce((t, r) => t + r.clicks, 0), leads,
      costPerLeadCents: leads ? Math.round(spendCents / leads) : null,
      daily: [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
    };
  });
}
