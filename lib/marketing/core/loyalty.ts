import 'server-only';
import { randomInt } from 'node:crypto';
import { emit } from '@/lib/automations/engine';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadEngagementSignals } from './crm-data';
import { NO_ENGAGEMENT, withEngagement } from './engagement';
import { nextSendTime, quietHoursWindow } from './policy';
import { isExpiringSoon, parseTierPerks, singleUseCode, TIER_NAME } from './promotions';
import { isTierUpgrade, pointsForPayment, tierForSpend, validateRedemption, type OfferCheck } from './rewards';
import type { LoyaltyTier } from './segment-rules';
import { scoreLead, lifecycleStageFor } from './scoring';
import { getMarketingSettings, type Db } from './settings';

/**
 * Awards points for paid invoices (once each) and recomputes balances, lifetime
 * spend and VIP tier for every customer with activity.
 */
export async function syncLoyalty(db: Db = createAdminClient()): Promise<{ accounts: number; upgrades: number }> {
  const settings = await getMarketingSettings(db);
  const { data: invoices, error } = await db.from('invoices').select('id, customer_id, total_cents, paid_at').eq('status', 'paid');
  if (error) throw new Error(`loyalty invoices load failed: ${error.message}`);

  const earn = (invoices ?? []).map((i) => ({
    customer_id: i.customer_id, kind: 'earn', points: pointsForPayment(i.total_cents, settings.loyaltyPointsPerDollar),
    invoice_id: i.id, note: 'Paid invoice', dedupe_key: `earn:invoice:${i.id}`, created_at: i.paid_at ?? undefined,
  })).filter((e) => e.points > 0);
  if (earn.length) {
    const { error: earnError } = await db.from('loyalty_events').upsert(earn, { onConflict: 'dedupe_key', ignoreDuplicates: true });
    if (earnError) throw new Error(`loyalty earn failed: ${earnError.message}`);
  }

  const [{ data: events }, { data: accounts }] = await Promise.all([
    db.from('loyalty_events').select('customer_id, kind, points'),
    db.from('loyalty_accounts').select('customer_id, tier'),
  ]);
  const spend = new Map<string, number>();
  for (const i of invoices ?? []) spend.set(i.customer_id, (spend.get(i.customer_id) ?? 0) + i.total_cents);
  const balance = new Map<string, { balance: number; lifetime: number }>();
  for (const e of events ?? []) {
    const row = balance.get(e.customer_id) ?? { balance: 0, lifetime: 0 };
    row.balance += e.kind === 'tier_change' ? 0 : e.points;
    if (e.points > 0 && e.kind !== 'tier_change') row.lifetime += e.points;
    balance.set(e.customer_id, row);
  }
  const previousTier = new Map((accounts ?? []).map((a) => [a.customer_id, a.tier as LoyaltyTier]));
  const now = new Date().toISOString();
  let upgrades = 0;
  const upgraded: { customerId: string; tier: LoyaltyTier }[] = [];
  const rows = [...new Set([...spend.keys(), ...balance.keys()])].map((customerId) => {
    const tier = tierForSpend(spend.get(customerId) ?? 0, settings.tierThresholds);
    const before = previousTier.get(customerId) ?? 'stock';
    if (isTierUpgrade(before, tier)) {
      upgrades += 1;
      // Only accounts that already existed: the first sync must not notify every historical customer.
      if (previousTier.has(customerId)) upgraded.push({ customerId, tier });
    }
    return {
      customer_id: customerId, points_balance: Math.max(0, balance.get(customerId)?.balance ?? 0), lifetime_points: balance.get(customerId)?.lifetime ?? 0,
      lifetime_spend_cents: spend.get(customerId) ?? 0, tier, tier_updated_at: before !== tier ? now : undefined, updated_at: now,
    };
  });
  if (rows.length) {
    const { error: upsertError } = await db.from('loyalty_accounts').upsert(rows, { onConflict: 'customer_id' });
    if (upsertError) throw new Error(`loyalty accounts upsert failed: ${upsertError.message}`);
  }
  if (upgraded.length) await notifyTierUpgrades(db, upgraded, settings);
  return { accounts: rows.length, upgrades };
}

/** Recomputes lead scores and customer lifecycle stages. */
export async function syncScoresAndStages(db: Db = createAdminClient(), now = new Date()): Promise<void> {
  const [{ data: leads }, { data: customers }, { data: invoices }, { data: accounts }, engagement] = await Promise.all([
    db.from('leads').select('id, customer_id, service_id, platform, source, status, sms_consent, details, created_at, lead_score'),
    db.from('customers').select('id, lifecycle_stage'),
    db.from('invoices').select('customer_id, paid_at').eq('status', 'paid'),
    db.from('loyalty_accounts').select('customer_id, tier, lifetime_spend_cents'),
    loadEngagementSignals(db, now),
  ]);
  // Rule score plus what the person actually did lately (visits, clicks, replies).
  const signalsFor = (customerId: string | null) => (customerId ? engagement.get(customerId) ?? NO_ENGAGEMENT : NO_ENGAGEMENT);
  const leadScoreOf = (lead: { customer_id: string | null; service_id: string | null; platform: string | null; source: string; status: string; sms_consent: boolean; details: string | null; created_at: string }) =>
    withEngagement(
      scoreLead({ serviceId: lead.service_id, platform: lead.platform, source: lead.source, status: lead.status, smsConsent: lead.sms_consent, detailsLength: lead.details?.length ?? 0, createdAt: new Date(lead.created_at), now }),
      lead.status,
      signalsFor(lead.customer_id),
    );
  for (const lead of leads ?? []) {
    const score = leadScoreOf(lead);
    if (score !== lead.lead_score) await db.from('leads').update({ lead_score: score }).eq('id', lead.id);
  }
  const account = new Map((accounts ?? []).map((a) => [a.customer_id, a]));
  for (const customer of customers ?? []) {
    const paid = (invoices ?? []).filter((i) => i.customer_id === customer.id && i.paid_at).map((i) => Date.parse(i.paid_at!));
    const mine = (leads ?? []).filter((l) => l.customer_id === customer.id);
    const stage = lifecycleStageFor({
      paidVisits: paid.length, lastPaidAt: paid.length ? new Date(Math.max(...paid)) : null,
      lifetimeSpendCents: account.get(customer.id)?.lifetime_spend_cents ?? 0, tier: (account.get(customer.id)?.tier ?? 'stock') as LoyaltyTier,
      openLeads: mine.filter((l) => ['new', 'contacted', 'booked'].includes(l.status)).length, lostLeads: mine.filter((l) => l.status === 'lost').length, now,
    });
    const leadScore = Math.max(0, ...mine.map(leadScoreOf));
    if (stage !== customer.lifecycle_stage) await db.from('customers').update({ lifecycle_stage: stage }).eq('id', customer.id);
    if (mine.length) await db.from('customers').update({ lead_score: leadScore }).eq('id', customer.id);
  }
}

/** Emits `marketing.tier_upgraded` (once per customer per tier) with the new perk. */
async function notifyTierUpgrades(db: Db, upgraded: { customerId: string; tier: LoyaltyTier }[], settings: Awaited<ReturnType<typeof getMarketingSettings>>): Promise<void> {
  const { data: row } = await db.from('marketing_settings').select('tier_perks').eq('id', 1).maybeSingle();
  const perks = parseTierPerks(row?.tier_perks);
  const occurredAt = nextSendTime(new Date(), quietHoursWindow(settings.quietHoursStart, settings.quietHoursEnd, settings.timeZone));
  for (const { customerId, tier } of upgraded) {
    if (tier === 'stock') continue;
    await emit({ name: 'marketing.tier_upgraded', subjectType: 'customer', subjectId: customerId, discriminator: `tier:${tier}`, occurredAt, context: { due_service: `${TIER_NAME[tier]} (${perks[tier].perk})` } });
  }
}

export interface RedeemResult {
  offerId?: string;
  offerCodeId?: string | null;
  redemptionId?: string;
  offerName?: string;
  giftItem?: string | null;
}

/**
 * Validates an offer code (shared or single-use) for a customer and subtotal.
 * With `commit`, records the redemption and burns a single-use code.
 */
export async function redeemOffer(
  input: { code: string; customerId: string | null; subtotalCents: number; workOrderId?: string | null; invoiceId?: string | null; commit?: boolean },
  db: Db = createAdminClient(),
): Promise<OfferCheck & RedeemResult> {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,32}$/.test(code)) return { ok: false, reason: 'Enter a valid code.' };
  const { data: shared } = await db.from('offers').select('*').eq('code', code).maybeSingle();
  let offer = shared;
  let offerCode: { id: string; customer_id: string | null; redeemed_at: string | null } | null = null;
  if (offer?.single_use) return { ok: false, reason: 'This offer needs the customer’s own code.' };
  if (!offer) {
    const { data: unique } = await db.from('offer_codes').select('id, customer_id, redeemed_at, offers(*)').eq('code', code).maybeSingle();
    if (!unique?.offers) return { ok: false, reason: 'Code not found.' };
    if (unique.redeemed_at) return { ok: false, reason: 'This code was already used.' };
    if (unique.customer_id && unique.customer_id !== input.customerId) return { ok: false, reason: 'This code belongs to another customer.' };
    offer = unique.offers;
    offerCode = unique;
  }
  const [total, mine, member] = await Promise.all([
    db.from('offer_redemptions').select('id', { count: 'exact', head: true }).eq('offer_id', offer.id),
    input.customerId ? db.from('offer_redemptions').select('id', { count: 'exact', head: true }).eq('offer_id', offer.id).eq('customer_id', input.customerId) : Promise.resolve({ count: 0 }),
    offer.segment_id && input.customerId ? db.from('segment_members').select('customer_id').eq('segment_id', offer.segment_id).eq('customer_id', input.customerId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const check = validateRedemption(offer, { now: new Date(), subtotalCents: input.subtotalCents, totalRedemptions: total.count ?? 0, customerRedemptions: mine.count ?? 0, inSegment: Boolean(member.data) });
  const meta: RedeemResult = { offerId: offer.id, offerCodeId: offerCode?.id ?? null, offerName: offer.name, giftItem: offer.gift_item };
  if (!check.ok || !input.commit) return { ...check, ...meta };

  if (offerCode) {
    const { data: burned } = await db.from('offer_codes').update({ redeemed_at: new Date().toISOString(), invoice_id: input.invoiceId ?? null }).eq('id', offerCode.id).is('redeemed_at', null).select('id');
    if (!burned?.length) return { ok: false, reason: 'This code was already used.' };
  }
  const { data: redemption, error } = await db.from('offer_redemptions')
    .insert({ offer_id: offer.id, customer_id: input.customerId, work_order_id: input.workOrderId ?? null, invoice_id: input.invoiceId ?? null, discount_cents: check.discountCents, offer_code_id: offerCode?.id ?? null })
    .select('id').single();
  if (error || !redemption) {
    if (offerCode) await db.from('offer_codes').update({ redeemed_at: null, invoice_id: null }).eq('id', offerCode.id);
    return { ok: false, reason: 'Could not record the redemption.' };
  }
  return { ...check, ...meta, redemptionId: redemption.id };
}

const CODE_ATTEMPTS = 5;
const secureRandom = () => randomInt(0, 1_000_000) / 1_000_000;

/** Creates `count` unassigned single-use codes for an offer. */
export async function generateOfferCodes(offerId: string, count: number, db: Db = createAdminClient()): Promise<{ ok: true; codes: string[] } | { ok: false; error: string }> {
  const { data: offer } = await db.from('offers').select('code').eq('id', offerId).maybeSingle();
  if (!offer) return { ok: false, error: 'Offer not found.' };
  const codes: string[] = [];
  for (let attempt = 0; attempt < CODE_ATTEMPTS && codes.length < count; attempt += 1) {
    const batch = Array.from({ length: count - codes.length }, () => singleUseCode(offer.code, secureRandom));
    const { data, error } = await db.from('offer_codes').upsert(batch.map((code) => ({ offer_id: offerId, code })), { onConflict: 'code', ignoreDuplicates: true }).select('code');
    if (error) return { ok: false, error: error.message };
    codes.push(...(data ?? []).map((r) => r.code));
  }
  return { ok: true, codes };
}

/**
 * The code to put in a campaign message: the shared code, or for single-use
 * offers a code issued to this customer for this send (idempotent per send).
 */
export async function offerCodeForSend(input: { offerId: string; sharedCode: string | null; customerId: string; sendId: string }, db: Db = createAdminClient()): Promise<string> {
  const { data: offer } = await db.from('offers').select('code, single_use').eq('id', input.offerId).maybeSingle();
  if (!offer?.single_use) return input.sharedCode ?? offer?.code ?? '';
  const { data: existing } = await db.from('offer_codes').select('code').eq('campaign_send_id', input.sendId).maybeSingle();
  if (existing) return existing.code;
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = singleUseCode(offer.code, secureRandom);
    const { error } = await db.from('offer_codes').insert({ offer_id: input.offerId, code, customer_id: input.customerId, campaign_send_id: input.sendId });
    if (!error) return code;
    const { data: raced } = await db.from('offer_codes').select('code').eq('campaign_send_id', input.sendId).maybeSingle();
    if (raced) return raced.code;
  }
  return '';
}

/**
 * 48h before an offer ends, reminds customers who were sent it (campaign or
 * personal code) and haven’t used it. Consent, caps and quiet hours apply downstream.
 */
export async function sweepOfferExpiry(now = new Date(), db: Db = createAdminClient()): Promise<{ offers: number; emitted: number }> {
  const horizon = new Date(now.getTime() + 2 * 86_400_000).toISOString();
  const { data: offers } = await db.from('offers').select('id, code, name, ends_at, single_use').eq('active', true).gt('ends_at', now.toISOString()).lte('ends_at', horizon);
  const due = (offers ?? []).filter((o) => isExpiringSoon(o.ends_at, now));
  if (!due.length) return { offers: 0, emitted: 0 };
  const settings = await getMarketingSettings(db);
  const occurredAt = nextSendTime(now, quietHoursWindow(settings.quietHoursStart, settings.quietHoursEnd, settings.timeZone));
  let emitted = 0;
  for (const offer of due) {
    const [{ data: campaigns }, { data: codes }, { data: used }] = await Promise.all([
      db.from('campaigns').select('id').eq('offer_id', offer.id),
      db.from('offer_codes').select('customer_id, code').eq('offer_id', offer.id).is('redeemed_at', null).not('customer_id', 'is', null),
      db.from('offer_redemptions').select('customer_id').eq('offer_id', offer.id),
    ]);
    const campaignIds = (campaigns ?? []).map((c) => c.id);
    const { data: sends } = campaignIds.length
      ? await db.from('campaign_sends').select('customer_id').in('campaign_id', campaignIds).in('status', ['sent', 'simulated']).not('customer_id', 'is', null)
      : { data: [] as { customer_id: string | null }[] };
    const redeemed = new Set((used ?? []).map((u) => u.customer_id));
    const personal = new Map((codes ?? []).map((c) => [c.customer_id!, c.code]));
    const targets = new Set([...(offer.single_use ? [] : (sends ?? []).map((s) => s.customer_id!)), ...personal.keys()]);
    const ends = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: settings.timeZone }).format(new Date(offer.ends_at!));
    for (const customerId of targets) {
      if (redeemed.has(customerId)) continue;
      const code = personal.get(customerId) ?? offer.code;
      const { scheduled } = await emit({ name: 'marketing.offer_expiring', subjectType: 'customer', subjectId: customerId, discriminator: `offer:${offer.id}`, occurredAt, context: { due_service: `${offer.name} (code ${code}) ends ${ends}` } });
      if (scheduled > 0) emitted += 1;
    }
  }
  return { offers: due.length, emitted };
}
