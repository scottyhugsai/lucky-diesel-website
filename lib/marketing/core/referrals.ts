import 'server-only';
import { randomInt } from 'node:crypto';
import { emit } from '@/lib/automations/engine';
import { money } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
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

/**
 * Records that a lead/customer came from a referral code. Idempotent per
 * referred customer; self-referrals are ignored. Thanks the referrer.
 */
export async function captureReferral(
  input: { code: string; customerId?: string | null; leadId?: string | null },
  db: Db = createAdminClient(),
): Promise<{ ok: true; referralId: string } | { ok: false; error: string }> {
  const code = await lookupReferralCode(input.code, db);
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
  const { data: open } = await db.from('referrals').select('*, referral_codes(referrer_reward_cents)').in('status', ['pending', 'qualified']).not('referred_customer_id', 'is', null);
  if (!open?.length) return 0;
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
      { customer_id: referral.referrer_customer_id, kind: 'referral_bonus', points: Math.floor(reward / 100), note: 'Referral reward', dedupe_key: `referral:${referral.id}` },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    );
    await emit({ name: 'marketing.referral_rewarded', subjectType: 'customer', subjectId: referral.referrer_customer_id, discriminator: referral.id, context: { due_service: `${money(reward, { whole: true })} in shop credit` } });
    rewarded += 1;
  }
  return rewarded;
}
