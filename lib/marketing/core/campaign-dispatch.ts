import 'server-only';
import type { Tables } from '@/lib/db/database.types';
import { firstName, vehicleLabel } from '@/lib/format';
import { sendMessage } from '@/lib/messaging/send';
import { renderTemplate, type TemplateVars } from '@/lib/messaging/template';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { dripStepTime, exitReason, nextStepOrder, pickWinner, sendDedupeKey, stepFor, type VariantStats } from './campaign-plan';
import { windowFor } from './campaigns';
import { checkClaims } from './compliance';
import { unsubscribeUrl } from './gate';
import { trackedLink } from './links';
import { campaignAutomationKey, isWithinWindow, nextSendTime } from './policy';
import { getMarketingSettings, type Db, type MarketingSettings } from './settings';

type Campaign = Tables<'campaigns'>;
type Step = Tables<'campaign_steps'>;
type Send = Tables<'campaign_sends'>;

export interface CampaignDispatchSummary { processed: number; sent: number; skipped: number; failed: number; deferred: number }

interface Loaded { campaign: Campaign; steps: Step[]; linkCode: string | null; offerCode: string | null }

async function loadCampaigns(db: Db, ids: string[]): Promise<Map<string, Loaded>> {
  const [campaigns, steps, links, offers] = await Promise.all([
    db.from('campaigns').select('*').in('id', ids),
    db.from('campaign_steps').select('*').in('campaign_id', ids),
    db.from('short_links').select('code, campaign_id, created_at').in('campaign_id', ids).order('created_at'),
    db.from('offers').select('id, code'),
  ]);
  const offerCode = new Map((offers.data ?? []).map((o) => [o.id, o.code]));
  return new Map((campaigns.data ?? []).map((campaign) => [campaign.id, {
    campaign,
    steps: (steps.data ?? []).filter((s) => s.campaign_id === campaign.id),
    linkCode: (links.data ?? []).find((l) => l.campaign_id === campaign.id)?.code ?? null,
    offerCode: campaign.offer_id ? offerCode.get(campaign.offer_id) ?? null : null,
  }]));
}

/** Decides (once) and stores the A/B winner from the test cohort's clicks or bookings. */
async function ensureWinner(db: Db, loaded: Loaded): Promise<string> {
  if (loaded.campaign.ab_winner_variant) return loaded.campaign.ab_winner_variant;
  const { data: sends } = await db.from('campaign_sends').select('variant, status, clicked_at, converted_at').eq('campaign_id', loaded.campaign.id).not('variant', 'is', null);
  const stats = new Map<string, VariantStats>();
  for (const s of sends ?? []) {
    const row = stats.get(s.variant!) ?? { variant: s.variant!, sent: 0, clicks: 0, bookings: 0 };
    if (s.status === 'sent' || s.status === 'simulated') row.sent += 1;
    if (s.clicked_at) row.clicks += 1;
    if (s.converted_at) row.bookings += 1;
    stats.set(s.variant!, row);
  }
  const winner = pickWinner([...stats.values()], loaded.campaign.ab_winner_metric === 'booking' ? 'booking' : 'click');
  await db.from('campaigns').update({ ab_winner_variant: winner }).eq('id', loaded.campaign.id).is('ab_winner_variant', null);
  loaded.campaign.ab_winner_variant = winner;
  return winner;
}

async function recipient(db: Db, customerId: string) {
  const [{ data: customer }, { data: vehicles }, { data: referral }] = await Promise.all([
    db.from('customers').select('id, full_name, email, phone').eq('id', customerId).maybeSingle(),
    db.from('vehicles').select('year, make, model, engine_code, nickname, platform, created_at').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(1),
    db.from('referral_codes').select('code').eq('customer_id', customerId).eq('active', true).maybeSingle(),
  ]);
  return customer ? { customer, vehicle: vehicles?.[0] ?? null, referralCode: referral?.code ?? null } : null;
}

async function exitFor(db: Db, campaign: Campaign, send: Send): Promise<string | null> {
  if (!send.enrollment_id || !send.customer_id) return null;
  const { data: enrollment } = await db.from('campaign_enrollments').select('enrolled_at, status').eq('id', send.enrollment_id).maybeSingle();
  if (!enrollment) return null;
  if (enrollment.status !== 'active') return `enrollment ${enrollment.status}`;
  const since = enrollment.enrolled_at;
  const [booked, replied, customer] = await Promise.all([
    db.from('appointments').select('id', { count: 'exact', head: true }).eq('customer_id', send.customer_id).gte('created_at', since).neq('status', 'cancelled'),
    db.from('messages').select('id', { count: 'exact', head: true }).eq('customer_id', send.customer_id).eq('direction', 'inbound').gte('created_at', since),
    db.from('customers').select('email_marketing_status, sms_marketing_opted_out_at, sms_opted_out_at').eq('id', send.customer_id).maybeSingle(),
  ]);
  const unsubscribed = campaign.channel === 'sms'
    ? Boolean(customer.data?.sms_marketing_opted_out_at || customer.data?.sms_opted_out_at)
    : customer.data?.email_marketing_status !== 'subscribed';
  return exitReason(campaign.exit_on, { bookedSinceEnrollment: (booked.count ?? 0) > 0, repliedSinceEnrollment: (replied.count ?? 0) > 0, unsubscribed });
}

function varsFor(loaded: Loaded, send: Send, person: NonNullable<Awaited<ReturnType<typeof recipient>>>): TemplateVars {
  const base = siteUrl();
  const address = send.channel === 'sms' ? person.customer.phone : person.customer.email;
  return {
    first_name: firstName(person.customer.full_name), customer_name: person.customer.full_name,
    vehicle: vehicleLabel(person.vehicle), platform: person.vehicle?.platform ?? '',
    business_name: BUSINESS.name, shop_phone: BUSINESS.phoneDisplay,
    booking_link: `${base}/book`, portal_link: `${base}/portal`,
    link: loaded.linkCode ? trackedLink(loaded.linkCode, send.id) : `${base}/book?utm_source=${send.channel}&utm_campaign=${loaded.campaign.utm_campaign ?? loaded.campaign.id}&ld_cid=${loaded.campaign.id}`,
    offer_code: loaded.offerCode ?? '',
    referral_code: person.referralCode ?? '', referral_link: person.referralCode ? `${base}/api/marketing/referral?code=${person.referralCode}` : '',
    unsubscribe_link: address ? unsubscribeUrl(send.channel, address, person.customer.id) : '',
  };
}

type Outcome = { status: 'sent' | 'simulated' | 'skipped' | 'failed' | 'cancelled'; detail: string; messageId?: string | null };

async function deliver(db: Db, loaded: Loaded, send: Send, settings: MarketingSettings, now: Date): Promise<Outcome | { defer: Date }> {
  const { campaign } = loaded;
  if (!send.customer_id) return { status: 'skipped', detail: 'customer deleted' };
  const exit = await exitFor(db, campaign, send);
  if (exit) {
    if (send.enrollment_id) await db.from('campaign_enrollments').update({ status: 'exited', exit_reason: exit, exited_at: now.toISOString(), next_step_at: null }).eq('id', send.enrollment_id).eq('status', 'active');
    return { status: 'cancelled', detail: `exited: ${exit}` };
  }
  const window = windowFor(campaign, settings);
  if (!isWithinWindow(now, window)) return { defer: nextSendTime(now, window) };

  const variant = send.variant ?? (await ensureWinner(db, loaded));
  const step = stepFor(loaded.steps, send.step_order, variant);
  if (!step) return { status: 'skipped', detail: 'step content missing' };
  const person = await recipient(db, send.customer_id);
  if (!person) return { status: 'skipped', detail: 'customer deleted' };
  const to = send.channel === 'sms' ? person.customer.phone : person.customer.email;
  if (!to) return { status: 'skipped', detail: `no ${send.channel === 'sms' ? 'phone' : 'email'} on file` };

  const vars = varsFor(loaded, send, person);
  const body = renderTemplate(step.body, vars);
  const subject = step.subject ? renderTemplate(step.subject, vars) : undefined;
  if (checkClaims(`${subject ?? ''}\n${body}`).risk === 'fail') return { status: 'skipped', detail: 'blocked by claims check' };

  if (send.variant === null) await db.from('campaign_sends').update({ variant }).eq('id', send.id);
  const result = await sendMessage({ channel: send.channel, to, subject, body, customerId: person.customer.id, automationKey: campaignAutomationKey(campaign.id), purpose: 'marketing' });
  const status = result.status === 'queued' ? 'sent' : result.status;
  return { status, detail: result.error ?? status, messageId: result.messageId };
}

async function scheduleNextStep(db: Db, loaded: Loaded, send: Send, settings: MarketingSettings, sentAt: Date): Promise<void> {
  if (!send.enrollment_id || !send.customer_id) return;
  const next = nextStepOrder(loaded.steps, send.step_order);
  if (next === null) {
    await db.from('campaign_enrollments').update({ status: 'completed', next_step_at: null }).eq('id', send.enrollment_id).eq('status', 'active');
    return;
  }
  const step = stepFor(loaded.steps, next, send.variant);
  const at = dripStepTime(sentAt, step?.delay_minutes ?? 0, windowFor(loaded.campaign, settings));
  await db.from('campaign_sends').upsert({
    campaign_id: loaded.campaign.id, step_order: next, enrollment_id: send.enrollment_id, customer_id: send.customer_id, channel: send.channel,
    variant: send.variant, dedupe_key: sendDedupeKey(loaded.campaign.id, next, send.customer_id), scheduled_for: at.toISOString(),
  }, { onConflict: 'dedupe_key', ignoreDuplicates: true });
  await db.from('campaign_enrollments').update({ current_step: next, next_step_at: at.toISOString() }).eq('id', send.enrollment_id);
}

/** Sends due campaign messages. Each row is claimed first so overlapping runs can't double-send. */
export async function dispatchCampaignSends(now = new Date(), limit = 200, db: Db = createAdminClient()): Promise<CampaignDispatchSummary> {
  const summary: CampaignDispatchSummary = { processed: 0, sent: 0, skipped: 0, failed: 0, deferred: 0 };
  const { data: due, error } = await db.from('campaign_sends').select('*').eq('status', 'scheduled').is('claimed_at', null)
    .lte('scheduled_for', now.toISOString()).order('scheduled_for').limit(limit);
  if (error) {
    console.error(`[marketing] could not load due campaign sends: ${error.message}`);
    return summary;
  }
  if (!due?.length) return summary;
  const [campaigns, settings] = await Promise.all([loadCampaigns(db, [...new Set(due.map((s) => s.campaign_id))]), getMarketingSettings(db)]);

  for (const send of due) {
    const loaded = campaigns.get(send.campaign_id);
    if (!loaded || !['sending', 'active'].includes(loaded.campaign.status)) continue; // paused/draft: leave for later
    const { data: claimed } = await db.from('campaign_sends').update({ claimed_at: new Date().toISOString() }).eq('id', send.id).eq('status', 'scheduled').is('claimed_at', null).select('id');
    if (!claimed?.length) continue;

    const outcome = await deliver(db, loaded, send, settings, now).catch((caught: unknown): Outcome => ({ status: 'failed', detail: caught instanceof Error ? caught.message : String(caught) }));
    if ('defer' in outcome) {
      await db.from('campaign_sends').update({ claimed_at: null, scheduled_for: outcome.defer.toISOString() }).eq('id', send.id);
      summary.deferred += 1;
      continue;
    }
    const delivered = outcome.status === 'sent' || outcome.status === 'simulated';
    await db.from('campaign_sends').update({ status: outcome.status, detail: outcome.detail.slice(0, 500), message_id: outcome.messageId ?? null, sent_at: delivered ? now.toISOString() : null }).eq('id', send.id);
    // A skipped step (no consent, cap reached) still lets the drip move on; exits and failures stop here.
    if (delivered || outcome.status === 'skipped') await scheduleNextStep(db, loaded, send, settings, now);
    summary.processed += 1;
    if (delivered) summary.sent += 1;
    else if (outcome.status === 'failed') summary.failed += 1;
    else summary.skipped += 1;
  }
  await completeFinishedBroadcasts(db, now);
  return summary;
}

async function completeFinishedBroadcasts(db: Db, now: Date): Promise<void> {
  const { data: sending } = await db.from('campaigns').select('id').eq('kind', 'broadcast').eq('status', 'sending');
  for (const campaign of sending ?? []) {
    const { count } = await db.from('campaign_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('status', 'scheduled');
    if ((count ?? 0) === 0) await db.from('campaigns').update({ status: 'sent', completed_at: now.toISOString() }).eq('id', campaign.id).eq('status', 'sending');
  }
}
