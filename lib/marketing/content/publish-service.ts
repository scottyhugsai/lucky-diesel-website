import 'server-only';
import { createHash } from 'node:crypto';
import { siteUrl } from '@/lib/site-url';
import { canPublish, isApprovalValid, type ContentStatus } from './approvals';
import { latestApproval, loadSubject } from './approvals-service';
import { checkBudget, type CampaignBudgetPlan } from './budget';
import { adAdapterFor } from './channels/registry';
import type { AdCampaignPayload } from './channels/types';
import { adminDb, fail, isCampaignPlatform, loadGuards, toJson, type Db, type Result } from './db';
import { isAdFormat } from './types';

/** The shop, for radius targeting. Charleston city centre until the owner sets the street address. */
const SHOP_LOCATION = { latitude: 32.7765, longitude: -79.9311, radiusMiles: 30 };
const LIVE_CAMPAIGN = ['approved', 'scheduled', 'live', 'paused'];
const CAMPAIGN_FOR_CREATIVE: Record<string, string> = { meta: 'meta', google_pmax: 'google', google_search: 'google', tiktok: 'tiktok' };

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

/** Spend so far this month and other live daily budgets, for the budget guards. */
export async function spendSnapshot(db: Db, platform: string, excludeCampaignId: string): Promise<{ platform: { monthToDateCents: number; otherLiveDailyCents: number }; shop: { monthToDateCents: number; otherLiveDailyCents: number } }> {
  const monthStart = `${today().slice(0, 8)}01`;
  const [{ data: metrics }, { data: live }] = await Promise.all([
    db.from('ad_metrics_daily').select('spend_cents, ad_publications!inner(platform)').gte('date', monthStart),
    db.from('ad_campaigns').select('id, platform, daily_budget_cents').eq('status', 'live').neq('id', excludeCampaignId),
  ]);
  const sum = (rows: { spend_cents: number }[]) => rows.reduce((total, row) => total + row.spend_cents, 0);
  const rows = metrics ?? [];
  const others = live ?? [];
  return {
    platform: { monthToDateCents: sum(rows.filter((r) => r.ad_publications.platform === platform)), otherLiveDailyCents: others.filter((c) => c.platform === platform).reduce((t, c) => t + c.daily_budget_cents, 0) },
    shop: { monthToDateCents: sum(rows), otherLiveDailyCents: others.reduce((t, c) => t + c.daily_budget_cents, 0) },
  };
}

/** Runs every guard the campaign falls under. Returns human-readable violations. */
export async function budgetViolations(db: Db, campaign: { id: string; platform: string; daily_budget_cents: number; starts_on: string | null; ends_on: string | null }): Promise<string[]> {
  if (!isCampaignPlatform(campaign.platform)) return ['Unknown ad platform.'];
  const guards = await loadGuards(db);
  const spend = await spendSnapshot(db, campaign.platform, campaign.id);
  const plan: CampaignBudgetPlan = { platform: campaign.platform, dailyBudgetCents: campaign.daily_budget_cents, startsOn: campaign.starts_on, endsOn: campaign.ends_on };
  const platformCheck = checkBudget(plan, guards.filter((g) => g.platform !== 'all'), spend.platform, today());
  const shopCheck = checkBudget(plan, guards.filter((g) => g.platform === 'all'), spend.shop, today());
  const messages = [...platformCheck.violations, ...shopCheck.violations].filter((v) => v.code !== 'no_guard').map((v) => v.message);
  if (platformCheck.violations.some((v) => v.code === 'no_guard') && shopCheck.violations.some((v) => v.code === 'no_guard')) messages.unshift('Set a budget guard before publishing.');
  return [...new Set(messages)];
}

async function approvedCampaign(db: Db, campaignId: string) {
  const [{ data: campaign }, snapshot, approval] = await Promise.all([
    db.from('ad_campaigns').select('*').eq('id', campaignId).maybeSingle(),
    loadSubject(db, 'ad_campaign', campaignId),
    latestApproval(db, 'ad_campaign', campaignId),
  ]);
  if (!campaign || !snapshot) return { error: 'Campaign not found.' } as const;
  if (!LIVE_CAMPAIGN.includes(campaign.status)) return { error: `Campaign is ${campaign.status.replace('_', ' ')}; it needs approval first.` } as const;
  if (!isApprovalValid(approval, snapshot.payload)) return { error: 'Campaign budget or dates changed since approval. Re-approve it.' } as const;
  return { campaign, approval: approval! } as const;
}

/**
 * Pushes an approved creative into an approved campaign. Live adapters create
 * everything PAUSED; demo adapters simulate. Never activates spend.
 */
export async function publishCreative(input: { creativeId: string; campaignId: string }, db: Db = adminDb()): Promise<Result<{ publications: number; simulated: boolean; reused: boolean }>> {
  try {
    const found = await approvedCampaign(db, input.campaignId);
    if ('error' in found) return { ok: false, error: found.error! };
    const { campaign } = found;
    const creativeSnapshot = await loadSubject(db, 'ad_creative', input.creativeId);
    const creativeApproval = await latestApproval(db, 'ad_creative', input.creativeId);
    if (!creativeSnapshot) return { ok: false, error: 'Creative not found.' };
    const gate = canPublish({ status: creativeSnapshot.status, approval: creativeApproval, payload: creativeSnapshot.payload, compliance: creativeSnapshot.compliance, warningsAcknowledged: creativeApproval?.warningsAcknowledged ?? false });
    if (!gate.ok) return { ok: false, error: gate.reason };
    const violations = await budgetViolations(db, campaign);
    if (violations.length) return { ok: false, error: violations.join(' ') };
    if (!isCampaignPlatform(campaign.platform) || !campaign.starts_on || !campaign.ends_on) return { ok: false, error: 'Campaign is missing a platform or dates.' };

    const attemptKey = createHash('sha256').update(`${input.creativeId}:${campaign.id}:${creativeApproval!.id}:${found.approval.id}`).digest('hex').slice(0, 32);
    const { data: existing } = await db.from('ad_publications').select('id, simulated').like('publish_attempt_key', `${attemptKey}:%`);
    if (existing?.length) return { ok: true, data: { publications: existing.length, simulated: existing.every((p) => p.simulated), reused: true } };

    const { data: creativeRow } = await db.from('ad_creatives').select('platform').eq('id', input.creativeId).single();
    if (!creativeRow || CAMPAIGN_FOR_CREATIVE[creativeRow.platform] !== campaign.platform) return { ok: false, error: `A ${creativeRow?.platform ?? 'unknown'} creative can’t run in a ${campaign.platform} campaign.` };
    const { data: variants } = await db.from('ad_creative_variants').select('*').eq('creative_id', input.creativeId).neq('compliance_status', 'block').order('label');
    const { data: creative } = await db.from('ad_creatives').select('landing_url').eq('id', input.creativeId).single();
    if (!variants?.length || !creative) return { ok: false, error: 'No publishable variants.' };

    const { adapter, connection } = await adAdapterFor(campaign.platform, db);
    const audience = (campaign.audience ?? {}) as { radiusMiles?: number };
    const payload: AdCampaignPayload = {
      campaignId: campaign.id, name: campaign.name, objective: campaign.objective as AdCampaignPayload['objective'], dailyBudgetCents: campaign.daily_budget_cents,
      startsOn: campaign.starts_on, endsOn: campaign.ends_on, ...SHOP_LOCATION, radiusMiles: audience.radiusMiles ?? SHOP_LOCATION.radiusMiles,
    };
    const result = await adapter.publish({
      attemptKey,
      campaign: payload,
      variants: variants.map((v) => ({
        variantId: v.id, headline: v.headline, longHeadline: v.long_headline, primaryText: v.primary_text, description: v.description, cta: v.cta,
        format: isAdFormat(v.format) ? v.format : '1:1', imageUrl: `${siteUrl()}/api/marketing/creative/${v.id}/image`, landingUrl: creative.landing_url ?? siteUrl(),
      })),
    });

    const { error } = await db.from('ad_publications').insert(variants.map((v) => ({
      variant_id: v.id, campaign_id: campaign.id, connection_id: connection.id, approval_id: creativeApproval!.id, platform: campaign.platform, mode: connection.mode,
      simulated: result.simulated, status_on_platform: result.statusOnPlatform, publish_attempt_key: `${attemptKey}:${v.id}`,
      external_ids: toJson({ ...result.externalIds, ad: result.externalIds[`ad:${v.id}`] ?? result.externalIds.ad ?? null }), request_preview: toJson(result.requestPreview),
    })));
    if (error) return { ok: false, error: error.message };
    await db.from('ad_creatives').update({ status: 'scheduled', campaign_id: campaign.id }).eq('id', input.creativeId);
    if (campaign.status === 'approved') await db.from('ad_campaigns').update({ status: 'scheduled', simulated: result.simulated }).eq('id', campaign.id);
    return { ok: true, data: { publications: variants.length, simulated: result.simulated, reused: false } };
  } catch (error) {
    return fail(error);
  }
}

async function setCampaignState(db: Db, campaignId: string, target: 'ACTIVE' | 'PAUSED', nextStatus: ContentStatus, note: string | null): Promise<Result<{ publications: number }>> {
  const { data: campaign } = await db.from('ad_campaigns').select('*').eq('id', campaignId).maybeSingle();
  if (!campaign || !isCampaignPlatform(campaign.platform)) return { ok: false, error: 'Campaign not found.' };
  const { data: publications } = await db.from('ad_publications').select('*').eq('campaign_id', campaignId);
  if (!publications?.length) return { ok: false, error: 'Nothing has been published to this campaign yet.' };
  const { adapter } = await adAdapterFor(campaign.platform, db);
  const done = new Set<string>();
  for (const publication of publications) {
    const ids = (publication.external_ids ?? {}) as Record<string, string>;
    const key = JSON.stringify(ids);
    if (!publication.simulated && !done.has(key)) await adapter.setStatus(ids, target);
    done.add(key);
    await db.from('ad_publications').update({ status_on_platform: publication.simulated ? `SIMULATED_${target}` : target, last_synced_at: new Date().toISOString() }).eq('id', publication.id);
  }
  await db.from('ad_campaigns').update({ status: nextStatus, notes: note ?? campaign.notes }).eq('id', campaignId);
  await db.from('ad_creatives').update({ status: nextStatus === 'live' ? 'live' : 'paused' }).eq('campaign_id', campaignId).in('status', ['scheduled', 'live', 'paused']);
  return { ok: true, data: { publications: publications.length } };
}

/** The owner's second, explicit click. Re-checks approval and budget guards before any spend. */
export async function activateCampaign(campaignId: string, db: Db = adminDb()): Promise<Result<{ publications: number }>> {
  try {
    const found = await approvedCampaign(db, campaignId);
    if ('error' in found) return { ok: false, error: found.error! };
    const violations = await budgetViolations(db, found.campaign);
    if (violations.length) return { ok: false, error: violations.join(' ') };
    return await setCampaignState(db, campaignId, 'ACTIVE', 'live', null);
  } catch (error) {
    return fail(error);
  }
}

export async function pauseCampaign(campaignId: string, reason: string, db: Db = adminDb()): Promise<Result<{ publications: number }>> {
  try {
    return await setCampaignState(db, campaignId, 'PAUSED', 'paused', `Paused: ${reason}`);
  } catch (error) {
    return fail(error);
  }
}
