import 'server-only';
import { randomInt } from 'node:crypto';
import { emit } from '@/lib/automations/engine';
import { money } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { siteUrl } from '@/lib/site-url';
import { nextSendTime, quietHoursWindow } from './policy';
import { pointsForCredit, referralAskTargets } from './promotions';
import { qualifyingInvoice, referralCode } from './rewards';
import { getMarketingSettings, type Db } from './settings';

const CODE = /^[A-Z0-9-]{4,32}$/;
const MAX_ATTEMPTS = 5;

export function normalizeReferralCode(value: string | null | undefined): string | null {
  const code = (value ?? '').trim().toUpperCase();
  return CODE.test(code) ? code : null;
}

/** The customer's referral code, creating one on first use. */
export async function ensureReferralCode(customerId: string, db: Db = createAdminClient()): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const { data: existing } = await db.from('referral_codes').select('code').eq('customer_id', customerId).maybeSingle();
  if (existing) return { ok: true, code: existing.code };
  const [{ data: customer }, settings] = await Promise.all([
    db.from('customers').select('full_name').eq('id', customerId).maybeSingle(),
    getMarketingSettings(db),
  ]);
  if (!customer) return { ok: false, error: 'Customer not found.' };
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const code = referralCode(customer.full_name, () => randomInt(0, 1_000_000) / 1_000_000);
    const { error } = await db.from('referral_codes').insert({ customer_id: customerId, code, referrer_reward_cents: settings.referrerRewardCents });
    if (!error) return { ok: true, code };
    if (error.code !== '23505') return { ok: false, error: error.message };
    const { data: raced } = await db.from('referral_codes').select('code').eq('customer_id', customerId).maybeSingle();
    if (raced) return { ok: true, code: raced.code };
  }
  return { ok: false, error: 'Could not generate a unique code.' };
}

/** Is this code usable? Used by the public referral landing route. */
export async function lookupReferralCode(code: string, db: Db = createAdminClient()): Promise<{ id: string; customerId: string } | null> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  const { data } = await db.from('referral_codes').select('id, customer_id, active').eq('code', normalized).maybeSingle();
  return data?.active ? { id: data.id, customerId: data.customer_id } : null;
}

export type AnyReferralCode = { type: 'customer'; id: string; customerId: string } | { type: 'partner'; id: string; name: string };

/** Customer code first, then an active dealer/partner code. */
export async function lookupAnyReferralCode(code: string, db: Db = createAdminClient()): Promise<AnyReferralCode | null> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  const customer = await lookupReferralCode(normalized, db);
  if (customer) return { type: 'customer', ...customer };
  const { data } = await db.from('referral_partners').select('id, name, active').eq('code', normalized).maybeSingle();
  return data?.active ? { type: 'partner', id: data.id, name: data.name } : null;
}

/** Partner (dealer) referral: one per referred customer, or per lead when no customer yet. */
async function capturePartnerReferral(partnerId: string, input: { customerId?: string | null; leadId?: string | null }, db: Db): Promise<{ ok: true; referralId: string } | { ok: false; error: string }> {
  if (!input.customerId && !input.leadId) return { ok: false, error: 'A lead or customer is required.' };
  const existing = input.customerId
    ? await db.from('partner_referrals').select('id').eq('customer_id', input.customerId).maybeSingle()
    : await db.from('partner_referrals').select('id').eq('lead_id', input.leadId!).maybeSingle();
  if (existing.data) return { ok: true, referralId: existing.data.id };
  const { data, error } = await db.from('partner_referrals').insert({ partner_id: partnerId, customer_id: input.customerId ?? null, lead_id: input.leadId ?? null }).select('id').single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not save referral.' };
  return { ok: true, referralId: data.id };
}

/**
 * Records that a lead/customer came from a referral code. Idempotent per
 * referred customer; self-referrals are ignored. Thanks the referrer.
 */
export async function captureReferral(
  input: { code: string; customerId?: string | null; leadId?: string | null },
  db: Db = createAdminClient(),
): Promise<{ ok: true; referralId: string } | { ok: false; error: string }> {
  const any = await lookupAnyReferralCode(input.code, db);
  if (any?.type === 'partner') return capturePartnerReferral(any.id, input, db);
  const code = any?.type === 'customer' ? any : null;
  if (!code) return { ok: false, error: 'Unknown or inactive referral code.' };
  if (input.customerId && input.customerId === code.customerId) return { ok: false, error: 'Customers can’t refer themselves.' };
  if (!input.customerId && !input.leadId) return { ok: false, error: 'A lead or customer is required.' };

  if (input.customerId) {
    const { data: existing } = await db.from('referrals').select('id').eq('referred_customer_id', input.customerId).maybeSingle();
    if (existing) return { ok: true, referralId: existing.id };
  }
  const { data, error } = await db.from('referrals')
    .insert({ referral_code_id: code.id, referrer_customer_id: code.customerId, referred_customer_id: input.customerId ?? null, lead_id: input.leadId ?? null })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not save referral.' };

  const { data: codeRow } = await db.from('referral_codes').select('uses').eq('id', code.id).single();
  await db.from('referral_codes').update({ uses: (codeRow?.uses ?? 0) + 1 }).eq('id', code.id);
  const settings = await getMarketingSettings(db);
  await emit({ name: 'marketing.referral_created', subjectType: 'customer', subjectId: code.customerId, discriminator: data.id, context: { due_service: `${money(settings.referrerRewardCents, { whole: true })} in shop credit` } });
  return { ok: true, referralId: data.id };
}

/**
 * Rewards referrers once the referred customer's first job is paid: marks the
 * referral rewarded, logs a loyalty bonus and emits the reward message.
 */
export async function processReferralRewards(now = new Date(), db: Db = createAdminClient()): Promise<number> {
  const partnerRewarded = await processPartnerRewards(now, db);
  const { data: open } = await db.from('referrals').select('*, referral_codes(referrer_reward_cents)').in('status', ['pending', 'qualified']).not('referred_customer_id', 'is', null);
  if (!open?.length) return partnerRewarded;
  const { data: program } = await db.from('marketing_settings').select('point_value_cents').eq('id', 1).maybeSingle();
  const pointValue = program?.point_value_cents ?? 5;
  const { data: invoices } = await db.from('invoices').select('id, customer_id, paid_at, status').eq('status', 'paid').in('customer_id', open.map((r) => r.referred_customer_id!));
  let rewarded = 0;
  for (const referral of open) {
    const invoice = qualifyingInvoice(referral, invoices ?? []);
    if (!invoice) continue;
    const reward = referral.referral_codes?.referrer_reward_cents ?? 0;
    const { data: updated } = await db.from('referrals')
      .update({ status: 'rewarded', invoice_id: invoice.id, reward_cents: reward, qualified_at: invoice.paid_at, rewarded_at: now.toISOString() })
      .eq('id', referral.id).in('status', ['pending', 'qualified']).select('id');
    if (!updated?.length) continue;
    await db.from('loyalty_events').upsert(
      { customer_id: referral.referrer_customer_id, kind: 'referral_bonus', points: pointsForCredit(reward, pointValue), note: 'Referral reward', dedupe_key: `referral:${referral.id}` },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    );
    await emit({ name: 'marketing.referral_rewarded', subjectType: 'customer', subjectId: referral.referrer_customer_id, discriminator: referral.id, context: { due_service: `${money(reward, { whole: true })} in shop credit` } });
    rewarded += 1;
  }
  return rewarded + partnerRewarded;
}

/** Marks dealer referrals rewarded on the referred customer's first paid job (payout via monthly statement). */
async function processPartnerRewards(now: Date, db: Db): Promise<number> {
  const { data: open } = await db.from('partner_referrals').select('id, customer_id, created_at, status, referral_partners(reward_cents)').in('status', ['pending', 'qualified']).not('customer_id', 'is', null);
  if (!open?.length) return 0;
  const { data: invoices } = await db.from('invoices').select('id, customer_id, paid_at, status').eq('status', 'paid').in('customer_id', open.map((r) => r.customer_id!));
  let rewarded = 0;
  for (const row of open) {
    const invoice = qualifyingInvoice({ status: row.status, referred_customer_id: row.customer_id, created_at: row.created_at }, invoices ?? []);
    if (!invoice) continue;
    const { data: updated } = await db.from('partner_referrals')
      .update({ status: 'rewarded', invoice_id: invoice.id, reward_cents: row.referral_partners?.reward_cents ?? 0, rewarded_at: now.toISOString() })
      .eq('id', row.id).in('status', ['pending', 'qualified']).select('id');
    if (updated?.length) rewarded += 1;
  }
  return rewarded;
}

/**
 * Asks happy customers to refer a friend: a few days after a paid job, or
 * right after a 9–10 survey score. Never based on reviews; at most twice a year.
 */
export async function sweepReferralAsks(now = new Date(), db: Db = createAdminClient()): Promise<{ planned: number; emitted: number }> {
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [{ data: paid }, npsResult, settings] = await Promise.all([
    db.from('invoices').select('customer_id, paid_at').eq('status', 'paid').gte('paid_at', since),
    db.from('nps_responses').select('customer_id, score, responded_at').gte('responded_at', since).not('customer_id', 'is', null).not('score', 'is', null),
    getMarketingSettings(db),
  ]);
  if (npsResult.error) console.error(`[marketing] referral asks: nps unavailable: ${npsResult.error.message}`);
  const targets = referralAskTargets({
    now,
    paid: (paid ?? []).flatMap((p) => (p.paid_at ? [{ customerId: p.customer_id, paidAt: p.paid_at }] : [])),
    nps: (npsResult.data ?? []).map((n) => ({ customerId: n.customer_id!, score: n.score!, respondedAt: n.responded_at! })),
  });
  const occurredAt = nextSendTime(now, quietHoursWindow(settings.quietHoursStart, settings.quietHoursEnd, settings.timeZone));
  let emitted = 0;
  for (const target of targets.slice(0, 200)) {
    const code = await ensureReferralCode(target.customerId, db);
    if (!code.ok) continue;
    const { scheduled } = await emit({ name: 'marketing.referral_ask', subjectType: 'customer', subjectId: target.customerId, discriminator: target.discriminator, occurredAt, context: { due_service: `${siteUrl()}/refer/${code.code}` } });
    if (scheduled > 0) emitted += 1;
  }
  return { planned: targets.length, emitted };
}
