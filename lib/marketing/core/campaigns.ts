import 'server-only';
import type { Tables, TablesInsert } from '@/lib/db/database.types';
import { createAdminClient } from '@/lib/supabase/admin';
import { assignVariant, bestSendHour, broadcastSendTime, campaignWindow, dripStepTime, optimizedSendTime, sendDedupeKey, stepFor, variantsOf } from './campaign-plan';
import { checkClaims, type ClaimIssue } from './compliance';
import { checkDeliverability } from './deliverability';
import { blocksText, parseBlocks } from './email-blocks';
import { ensureCampaignLink } from './links';
import { refreshSegment } from './segments';
import { getMarketingSettings, type Db, type MarketingSettings } from './settings';

type Campaign = Tables<'campaigns'>;
type Step = Tables<'campaign_steps'>;
export type CampaignResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; issues?: ClaimIssue[] };

const CHUNK = 500;
const MATERIALIZE_LEAD_MS = 15 * 60_000;

export function windowFor(campaign: Pick<Campaign, 'send_window_start_hour' | 'send_window_end_hour'>, settings: MarketingSettings) {
  return campaignWindow(campaign, { start: settings.quietHoursStart, end: settings.quietHoursEnd, timeZone: settings.timeZone });
}

/** Every step must pass the emissions/claims check (blocks included) and hard deliverability rules before anything is scheduled. */
export function lintSteps(steps: readonly (Pick<Step, 'subject' | 'body' | 'step_order' | 'variant'> & { blocks?: Step['blocks'] })[], channel: 'email' | 'sms' = 'email'): ClaimIssue[] {
  return steps.flatMap((step) => {
    const parsed = parseBlocks(step.blocks ?? []);
    const extra = parsed.ok ? blocksText(parsed.value) : '';
    const claims = checkClaims(`${step.subject ?? ''}\n${step.body}\n${extra}`).issues.filter((i) => i.severity === 'block');
    const delivery = checkDeliverability({ channel, subject: step.subject, body: step.body, extraText: extra })
      .filter((i) => i.severity === 'block')
      .map((i): ClaimIssue => ({ severity: 'block', rule: i.rule, match: 'link', index: 0, reason: i.message }));
    return [...claims, ...delivery];
  });
}

async function loadCampaign(db: Db, campaignId: string): Promise<{ campaign: Campaign; steps: Step[] } | null> {
  const [{ data: campaign }, { data: steps }] = await Promise.all([
    db.from('campaigns').select('*').eq('id', campaignId).maybeSingle(),
    db.from('campaign_steps').select('*').eq('campaign_id', campaignId).order('step_order'),
  ]);
  return campaign ? { campaign, steps: steps ?? [] } : null;
}

/** Schedules a draft/paused broadcast for `at`. Drips and lifecycle campaigns are activated instead. */
export async function scheduleCampaign(campaignId: string, at: Date, db: Db = createAdminClient()): Promise<CampaignResult<{ status: string }>> {
  const loaded = await loadCampaign(db, campaignId);
  if (!loaded) return { ok: false, error: 'Campaign not found.' };
  const { campaign, steps } = loaded;
  if (!['draft', 'paused', 'scheduled'].includes(campaign.status)) return { ok: false, error: `A ${campaign.status} campaign can’t be scheduled.` };
  if (!steps.length) return { ok: false, error: 'Add message content first.' };
  if (campaign.channel === 'email' && steps.some((s) => !s.subject?.trim())) return { ok: false, error: 'Every email step needs a subject.' };
  if (!campaign.segment_id && campaign.kind === 'broadcast') return { ok: false, error: 'Pick a segment to send to.' };
  const issues = lintSteps(steps, campaign.channel === 'sms' ? 'sms' : 'email');
  if (issues.length) return { ok: false, error: 'Message content failed the compliance check.', issues };

  // Branded, per-recipient tracked {{link}}: without it click reports and click-based A/B winners stay at zero.
  const link = await ensureCampaignLink(campaignId, campaign.channel, db);
  if (!link.ok) return { ok: false, error: `Tracking link failed: ${link.error}` };

  const status = campaign.kind === 'broadcast' ? 'scheduled' : 'active';
  const { error } = await db.from('campaigns').update({ status, scheduled_at: at.toISOString(), started_at: campaign.kind === 'broadcast' ? null : at.toISOString() }).eq('id', campaignId);
  return error ? { ok: false, error: error.message } : { ok: true, data: { status } };
}

export async function pauseCampaign(campaignId: string, db: Db = createAdminClient()): Promise<CampaignResult> {
  const { error } = await db.from('campaigns').update({ status: 'paused' }).eq('id', campaignId).in('status', ['scheduled', 'sending', 'active']);
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

const STO_LOOKBACK_MS = 365 * 86_400_000;

/** Past opens, clicks and bookings per customer, for send-time optimization. */
async function engagementTimes(db: Db, customerIds: string[], now: Date): Promise<Map<string, Date[]>> {
  const since = new Date(now.getTime() - STO_LOOKBACK_MS).toISOString();
  const times = new Map<string, Date[]>();
  const add = (id: string | null, at: string | null) => {
    if (!id || !at) return;
    times.set(id, [...(times.get(id) ?? []), new Date(at)]);
  };
  for (let i = 0; i < customerIds.length; i += CHUNK) {
    const ids = customerIds.slice(i, i + CHUNK);
    const [sends, bookings] = await Promise.all([
      db.from('campaign_sends').select('customer_id, opened_at, clicked_at').in('customer_id', ids).gte('created_at', since).or('opened_at.not.is.null,clicked_at.not.is.null'),
      db.from('appointments').select('customer_id, created_at').in('customer_id', ids).gte('created_at', since),
    ]);
    for (const s of sends.data ?? []) {
      add(s.customer_id, s.clicked_at);
      if (s.opened_at !== s.clicked_at) add(s.customer_id, s.opened_at);
    }
    for (const b of bookings.data ?? []) add(b.customer_id, b.created_at);
  }
  return times;
}

async function upsertSends(db: Db, rows: TablesInsert<'campaign_sends'>[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from('campaign_sends').upsert(rows.slice(i, i + CHUNK), { onConflict: 'dedupe_key', ignoreDuplicates: true });
    if (error) throw new Error(`campaign sends insert failed: ${error.message}`);
  }
}

/**
 * Expands scheduled broadcasts due within 15 minutes into one `campaign_sends`
 * row per member (snapshotting the segment). Idempotent via the dedupe key.
 */
export async function materializeDueBroadcasts(now = new Date(), db: Db = createAdminClient()): Promise<number> {
  const { data: due } = await db.from('campaigns').select('*').eq('kind', 'broadcast').eq('status', 'scheduled')
    .lte('scheduled_at', new Date(now.getTime() + MATERIALIZE_LEAD_MS).toISOString());
  if (!due?.length) return 0;
  const settings = await getMarketingSettings(db);
  let total = 0;
  for (const campaign of due) {
    if (!campaign.segment_id) continue;
    const refreshed = await refreshSegment(campaign.segment_id, db, undefined, now);
    if (!refreshed.ok) {
      console.error(`[marketing] campaign ${campaign.id} segment refresh failed: ${refreshed.error}`);
      continue;
    }
    const [{ data: members }, { data: steps }] = await Promise.all([
      db.from('segment_members').select('customer_id').eq('segment_id', campaign.segment_id),
      db.from('campaign_steps').select('step_order, variant').eq('campaign_id', campaign.id),
    ]);
    const variants = variantsOf(steps ?? []);
    const window = windowFor(campaign, settings);
    const scheduledAt = new Date(campaign.scheduled_at ?? now);
    // Send-time optimization skips A/B tests: shifting cohorts would skew the winner.
    const optimize = campaign.send_time_optimized && (variants.length < 2 || campaign.ab_test_percent <= 0);
    const engaged = optimize ? await engagementTimes(db, (members ?? []).map((m) => m.customer_id), now) : new Map<string, Date[]>();
    const rows = (members ?? []).map(({ customer_id }) => {
      const variant = assignVariant(campaign.id, customer_id, variants, campaign.ab_test_percent);
      const at = optimize
        ? optimizedSendTime(scheduledAt, bestSendHour(engaged.get(customer_id) ?? [], window), window)
        : broadcastSendTime(scheduledAt, variant, campaign.ab_decide_after_minutes, window);
      return {
        campaign_id: campaign.id, step_order: 1, customer_id, channel: campaign.channel, variant,
        dedupe_key: sendDedupeKey(campaign.id, 1, customer_id),
        scheduled_for: at.toISOString(),
      };
    });
    await upsertSends(db, rows);
    await db.from('campaigns').update({ status: 'sending', started_at: now.toISOString() }).eq('id', campaign.id).eq('status', 'scheduled');
    total += rows.length;
  }
  return total;
}

/**
 * Enrolls one customer in an active drip/lifecycle campaign and schedules step 1.
 * Returns false when already enrolled (enrollment is once per campaign).
 */
export async function enrollCustomer(campaignId: string, customerId: string, at = new Date(), db: Db = createAdminClient()): Promise<boolean> {
  const loaded = await loadCampaign(db, campaignId);
  if (!loaded || loaded.campaign.status !== 'active' || loaded.campaign.kind === 'broadcast') return false;
  const { campaign, steps } = loaded;
  const first = [...steps].sort((a, b) => a.step_order - b.step_order)[0];
  if (!first) return false;
  const variant = assignVariant(campaign.id, customerId, variantsOf(steps, first.step_order), 100);
  const { data: enrollment, error } = await db.from('campaign_enrollments')
    .upsert({ campaign_id: campaignId, customer_id: customerId, variant, enrolled_at: at.toISOString() }, { onConflict: 'campaign_id,customer_id', ignoreDuplicates: true })
    .select('id');
  if (error) throw new Error(`enrollment failed: ${error.message}`);
  if (!enrollment?.length) return false;

  const settings = await getMarketingSettings(db);
  const step = stepFor(steps, first.step_order, variant) ?? first;
  const sendAt = dripStepTime(at, step.delay_minutes, windowFor(campaign, settings));
  await upsertSends(db, [{
    campaign_id: campaignId, step_order: first.step_order, enrollment_id: enrollment[0]!.id, customer_id: customerId, channel: campaign.channel,
    variant, dedupe_key: sendDedupeKey(campaignId, first.step_order, customerId), scheduled_for: sendAt.toISOString(),
  }]);
  await db.from('campaign_enrollments').update({ current_step: first.step_order, next_step_at: sendAt.toISOString() }).eq('id', enrollment[0]!.id);
  return true;
}

/** Enrolls a customer in every active drip/lifecycle campaign listening for an event name. */
export async function enrollByTrigger(eventName: string, customerId: string, at = new Date(), db: Db = createAdminClient()): Promise<number> {
  const { data: campaigns } = await db.from('campaigns').select('id').eq('status', 'active').eq('trigger_event', eventName).neq('kind', 'broadcast');
  let enrolled = 0;
  for (const campaign of campaigns ?? []) if (await enrollCustomer(campaign.id, customerId, at, db)) enrolled += 1;
  return enrolled;
}

/** Active drips tied to a segment (and no trigger) auto-enroll new segment members. */
export async function enrollSegmentDrips(now = new Date(), db: Db = createAdminClient()): Promise<number> {
  const { data: campaigns } = await db.from('campaigns').select('id, segment_id').eq('status', 'active').neq('kind', 'broadcast').is('trigger_event', null).not('segment_id', 'is', null);
  let enrolled = 0;
  for (const campaign of campaigns ?? []) {
    const [{ data: members }, { data: enrollments }] = await Promise.all([
      db.from('segment_members').select('customer_id').eq('segment_id', campaign.segment_id!),
      db.from('campaign_enrollments').select('customer_id').eq('campaign_id', campaign.id),
    ]);
    const already = new Set((enrollments ?? []).map((e) => e.customer_id));
    for (const member of members ?? []) {
      if (!already.has(member.customer_id) && (await enrollCustomer(campaign.id, member.customer_id, now, db))) enrolled += 1;
    }
  }
  return enrolled;
}
