import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
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
  const rows = [...new Set([...spend.keys(), ...balance.keys()])].map((customerId) => {
    const tier = tierForSpend(spend.get(customerId) ?? 0, settings.tierThresholds);
    const before = previousTier.get(customerId) ?? 'stock';
    if (isTierUpgrade(before, tier)) upgrades += 1;
    return {
      customer_id: customerId, points_balance: Math.max(0, balance.get(customerId)?.balance ?? 0), lifetime_points: balance.get(customerId)?.lifetime ?? 0,
      lifetime_spend_cents: spend.get(customerId) ?? 0, tier, tier_updated_at: before !== tier ? now : undefined, updated_at: now,
    };
  });
  if (rows.length) {
    const { error: upsertError } = await db.from('loyalty_accounts').upsert(rows, { onConflict: 'customer_id' });
    if (upsertError) throw new Error(`loyalty accounts upsert failed: ${upsertError.message}`);
  }
  return { accounts: rows.length, upgrades };
}

/** Recomputes lead scores and customer lifecycle stages. */
export async function syncScoresAndStages(db: Db = createAdminClient(), now = new Date()): Promise<void> {
  const [{ data: leads }, { data: customers }, { data: invoices }, { data: accounts }] = await Promise.all([
    db.from('leads').select('id, customer_id, service_id, platform, source, status, sms_consent, details, created_at, lead_score'),
    db.from('customers').select('id, lifecycle_stage'),
    db.from('invoices').select('customer_id, paid_at').eq('status', 'paid'),
    db.from('loyalty_accounts').select('customer_id, tier, lifetime_spend_cents'),
  ]);
  for (const lead of leads ?? []) {
    const score = scoreLead({ serviceId: lead.service_id, platform: lead.platform, source: lead.source, status: lead.status, smsConsent: lead.sms_consent, detailsLength: lead.details?.length ?? 0, createdAt: new Date(lead.created_at), now });
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
    const leadScore = Math.max(0, ...mine.map((l) => scoreLead({ serviceId: l.service_id, platform: l.platform, source: l.source, status: l.status, smsConsent: l.sms_consent, detailsLength: l.details?.length ?? 0, createdAt: new Date(l.created_at), now })));
    if (stage !== customer.lifecycle_stage) await db.from('customers').update({ lifecycle_stage: stage }).eq('id', customer.id);
    if (mine.length) await db.from('customers').update({ lead_score: leadScore }).eq('id', customer.id);
  }
}

/**
 * Validates an offer code for a customer and subtotal. With `commit`, records
 * the redemption (advisor applies it at estimate/invoice time).
 */
export async function redeemOffer(
  input: { code: string; customerId: string | null; subtotalCents: number; workOrderId?: string | null; invoiceId?: string | null; commit?: boolean },
  db: Db = createAdminClient(),
): Promise<OfferCheck & { offerId?: string }> {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,32}$/.test(code)) return { ok: false, reason: 'Enter a valid code.' };
  const { data: offer } = await db.from('offers').select('*').eq('code', code).maybeSingle();
  if (!offer) return { ok: false, reason: 'Code not found.' };
  const [total, mine, member] = await Promise.all([
    db.from('offer_redemptions').select('id', { count: 'exact', head: true }).eq('offer_id', offer.id),
    input.customerId ? db.from('offer_redemptions').select('id', { count: 'exact', head: true }).eq('offer_id', offer.id).eq('customer_id', input.customerId) : Promise.resolve({ count: 0 }),
    offer.segment_id && input.customerId ? db.from('segment_members').select('customer_id').eq('segment_id', offer.segment_id).eq('customer_id', input.customerId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const check = validateRedemption(offer, { now: new Date(), subtotalCents: input.subtotalCents, totalRedemptions: total.count ?? 0, customerRedemptions: mine.count ?? 0, inSegment: Boolean(member.data) });
  if (!check.ok || !input.commit) return { ...check, offerId: offer.id };
  const { error } = await db.from('offer_redemptions').insert({ offer_id: offer.id, customer_id: input.customerId, work_order_id: input.workOrderId ?? null, invoice_id: input.invoiceId ?? null, discount_cents: check.discountCents });
  if (error) return { ok: false, reason: 'Could not record the redemption.' };
  return { ...check, offerId: offer.id };
}
