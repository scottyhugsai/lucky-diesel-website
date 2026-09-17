'use server';

import { revalidatePath } from 'next/cache';
import { type ActionState, InputError, dollarsToCents, guard, number, oneOf, requiredText, requiredUuid, text } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { submitForApproval } from '@/lib/marketing/content/approvals-service';
import { daysInclusive } from '@/lib/marketing/content/budget';
import { adminDb, loadGuards } from '@/lib/marketing/content/db';
import { activateCampaign, pauseCampaign, publishCreative } from '@/lib/marketing/content/publish-service';

const PLATFORMS = ['meta', 'google', 'tiktok'] as const;
const OBJECTIVES = ['leads', 'traffic', 'calls', 'awareness', 'sales'] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function refresh() {
  revalidatePath('/admin/marketing/ads/campaigns');
  revalidatePath('/admin/marketing/ads/approvals');
  revalidatePath('/admin/marketing/ads/performance');
}

function dateField(form: FormData, name: string, label: string): string {
  const value = requiredText(form, name, label, 10);
  if (!DATE_RE.test(value) || Number.isNaN(Date.parse(value))) throw new InputError(`${label} is not a valid date.`);
  return value;
}

function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/** Creates a campaign inside the budget guard and sends it for approval. */
export async function createCampaign(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const name = requiredText(form, 'name', 'Name', 80);
    const platform = oneOf(form, 'platform', PLATFORMS, 'platform');
    const objective = oneOf(form, 'objective', OBJECTIVES, 'objective');
    const radiusMiles = number(form, 'radius', { min: 5, max: 100, integer: true, required: true, label: 'Radius' })!;
    const audienceNote = text(form, 'audience', { max: 200, label: 'Audience' });
    const daily = dollarsToCents(form, 'daily', { required: true, label: 'Daily budget', max: 5000 })!;
    const startsOn = dateField(form, 'starts', 'Start date');
    const endsOn = dateField(form, 'ends', 'End date');
    if (daily < 100) throw new InputError('Daily budget must be at least $1.');
    if (endsOn < startsOn) throw new InputError('End date must be after the start date.');

    const db = adminDb();
    const guards = (await loadGuards(db)).filter((g) => g.active);
    const own = guards.find((g) => g.platform === platform);
    const shop = guards.find((g) => g.platform === 'all');
    if (!own && !shop) throw new InputError('Set a budget cap for this platform first.');
    for (const g of [own, shop]) {
      if (!g) continue;
      if (daily > g.maxDailyCents) throw new InputError(`Over the ${usd(g.maxDailyCents)}/day cap. Lower the budget or raise the cap.`);
      if (daysInclusive(startsOn, endsOn) > g.maxCampaignDays) throw new InputError(`Max ${g.maxCampaignDays} days per campaign.`);
    }

    const { data, error } = await db.from('ad_campaigns').insert({
      name, platform, objective, daily_budget_cents: daily, starts_on: startsOn, ends_on: endsOn, created_by: viewer.userId,
      audience: { radiusMiles, note: audienceNote }, generator: 'manual', simulated: true,
    }).select('id').single();
    if (error || !data) throw new Error(error?.message ?? 'Could not save the campaign.');
    const queued = await submitForApproval('ad_campaign', data.id, viewer.userId, db);
    if (!queued.ok) throw new InputError(queued.error);
    refresh();
    return { notice: 'Campaign saved and sent for approval.' };
  });
}

/** Re-sends a rejected or edited campaign. */
export async function resubmitCampaign(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'campaignId', 'Campaign');
    const db = adminDb();
    await db.from('ad_campaigns').update({ status: 'draft' }).eq('id', id).in('status', ['rejected', 'draft']);
    const queued = await submitForApproval('ad_campaign', id, viewer.userId, db);
    if (!queued.ok) throw new InputError(queued.error);
    refresh();
    return { notice: 'Sent for approval.' };
  });
}

/** Pushes an approved ad into an approved campaign (created paused). */
export async function publishToCampaign(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const campaignId = requiredUuid(form, 'campaignId', 'Campaign');
    const creativeId = requiredUuid(form, 'creativeId', 'Ad');
    const result = await publishCreative({ campaignId, creativeId });
    if (!result.ok) throw new InputError(result.error);
    refresh();
    revalidatePath('/admin/marketing/ads');
    const { publications, simulated, reused } = result.data;
    if (reused) return { notice: 'Already published. Nothing duplicated.' };
    return { notice: `Published ${publications} variants, paused${simulated ? ' (demo)' : ''}. Activate when ready.` };
  });
}

export async function activate(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const result = await activateCampaign(requiredUuid(form, 'campaignId', 'Campaign'));
    if (!result.ok) throw new InputError(result.error);
    refresh();
    return { notice: 'Live. Budget caps are enforced daily.' };
  });
}

export async function pause(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const result = await pauseCampaign(requiredUuid(form, 'campaignId', 'Campaign'), 'owner paused');
    if (!result.ok) throw new InputError(result.error);
    refresh();
    return { notice: 'Paused.' };
  });
}

/** Hard caps every campaign must stay under. */
export async function saveGuard(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const platform = oneOf(form, 'platform', ['all', ...PLATFORMS] as const, 'platform');
    const maxDaily = dollarsToCents(form, 'maxDaily', { required: true, label: 'Daily cap', max: 5000 })!;
    const maxMonthly = dollarsToCents(form, 'maxMonthly', { required: true, label: 'Monthly cap', max: 100_000 })!;
    const maxDays = number(form, 'maxDays', { min: 1, max: 365, integer: true, required: true, label: 'Max days' })!;
    const cpl = dollarsToCents(form, 'cpl', { label: 'Cost per lead cap', max: 1000 });
    if (maxMonthly < maxDaily) throw new InputError('Monthly cap must be at least the daily cap.');
    const { error } = await adminDb().from('budget_guards').upsert({
      platform, max_daily_cents: maxDaily, max_monthly_cents: maxMonthly, max_campaign_days: maxDays, auto_pause_cpl_cents: cpl, active: true,
    }, { onConflict: 'platform' });
    if (error) throw new Error(error.message);
    refresh();
    return { notice: 'Cap saved.' };
  });
}
