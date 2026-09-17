'use server';

import { revalidatePath } from 'next/cache';
import { checkbox, dollarsToCents, email, guard, number, oneOf, phone, requiredText, requiredUuid, text, type ActionState } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { MAX_PROGRAM_PERCENT, partnerCodeStem, tierPerksToJson, type PerkTier } from '@/lib/marketing/core/promotions';
import { ensureReferralCode, normalizeReferralCode } from '@/lib/marketing/core/referrals';
import { createAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/marketing/growth';

export async function createReferralCode(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const customerId = requiredUuid(form, 'customer_id', 'Customer');
    const result = await ensureReferralCode(customerId);
    if (!result.ok) return { error: result.error };
    revalidatePath(PATH);
    return { notice: `Code ready: ${result.code}` };
  });
}

export async function setReferralCodeActive(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'code_id', 'Code');
    const active = checkbox(form, 'active');
    const { error } = await createAdminClient().from('referral_codes').update({ active }).eq('id', id);
    if (error) return { error: 'Couldn’t update the code.' };
    revalidatePath(PATH);
    return { notice: active ? 'Code on.' : 'Code paused.' };
  });
}

/** Points up or down with a note. Balance never goes below zero. */
export async function adjustPoints(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const customerId = requiredUuid(form, 'customer_id', 'Customer');
    const points = number(form, 'points', { min: -100_000, max: 100_000, integer: true, required: true, label: 'Points' }) as number;
    const note = requiredText(form, 'note', 'Reason', 200);
    if (points === 0) return { error: 'Points can’t be zero.' };
    const db = createAdminClient();
    const { data: account } = await db.from('loyalty_accounts').select('points_balance, lifetime_points').eq('customer_id', customerId).maybeSingle();
    const balance = (account?.points_balance ?? 0) + points;
    if (balance < 0) return { error: `Only ${account?.points_balance ?? 0} points to remove.` };
    const { error: eventError } = await db.from('loyalty_events').insert({ customer_id: customerId, kind: 'adjust', points, note });
    if (eventError) return { error: 'Couldn’t log the change.' };
    const lifetime = (account?.lifetime_points ?? 0) + Math.max(points, 0);
    const { error } = await db.from('loyalty_accounts').upsert({ customer_id: customerId, points_balance: balance, lifetime_points: lifetime, updated_at: new Date().toISOString() }, { onConflict: 'customer_id' });
    if (error) return { error: 'Couldn’t update the balance.' };
    revalidatePath(PATH);
    return { notice: `Balance now ${balance.toLocaleString('en-US')}.` };
  });
}

/** Point value and per-tier perks. */
export async function saveLoyaltyProgram(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const pointValue = number(form, 'point_value_cents', { min: 1, max: 100, integer: true, required: true, label: 'Cents per point' }) as number;
    const read = (tier: PerkTier) => ({
      perk: requiredText(form, `perk_${tier}`, 'Perk', 80),
      laborPercent: number(form, `pct_${tier}`, { min: 0, max: MAX_PROGRAM_PERCENT, integer: true, required: true, label: 'Labor %' }) as number,
    });
    const perks = { stage_1: read('stage_1'), stage_2: read('stage_2'), full_build: read('full_build') };
    const { error } = await createAdminClient().from('marketing_settings').upsert({ id: 1, point_value_cents: pointValue, tier_perks: tierPerksToJson(perks) }, { onConflict: 'id' });
    if (error) return { error: 'Couldn’t save the program.' };
    revalidatePath(PATH);
    return { notice: 'Program saved.' };
  });
}

/** Staff record the customer's yes/no to public first-name recognition. */
export async function setLeaderboardOptIn(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const customerId = requiredUuid(form, 'customer_id', 'Customer');
    const optIn = checkbox(form, 'active');
    const { error } = await createAdminClient().from('customers').update({ referral_leaderboard_opt_in: optIn }).eq('id', customerId);
    if (error) return { error: 'Couldn’t update.' };
    revalidatePath(PATH);
    revalidatePath('/refer');
    return { notice: optIn ? 'Shown on the public board.' : 'Hidden from the public board.' };
  });
}

export async function createPartner(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const name = requiredText(form, 'name', 'Name', 80);
    const kind = oneOf(form, 'kind', ['boat_dealer', 'rv_dealer', 'trailer_dealer', 'other'] as const, 'type');
    const reward = dollarsToCents(form, 'reward', { label: 'Reward', max: 1000 }) ?? 2500;
    const custom = text(form, 'code', { max: 32, label: 'Code' });
    const code = custom ? normalizeReferralCode(custom.replace(/\s+/g, '-')) : partnerCodeStem(name);
    if (!code) return { error: 'Code: 4–32 letters, numbers or dashes.' };
    const db = createAdminClient();
    const { data: clash } = await db.from('referral_codes').select('id').eq('code', code).maybeSingle();
    if (clash) return { error: 'That code is a customer’s code.' };
    const { error } = await db.from('referral_partners').insert({
      name, kind, code, reward_cents: reward, contact_name: text(form, 'contact_name', { max: 80, label: 'Contact' }),
      email: email(form, 'email'), phone: phone(form, 'phone'), notes: text(form, 'notes', { max: 300, label: 'Notes' }),
    });
    if (error) return { error: error.code === '23505' ? 'That code is taken. Enter your own.' : 'Couldn’t save the partner.' };
    revalidatePath(PATH);
    return { notice: `${name} added: ${code}` };
  });
}

export async function setPartnerActive(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'partner_id', 'Partner');
    const active = checkbox(form, 'active');
    const { error } = await createAdminClient().from('referral_partners').update({ active }).eq('id', id);
    if (error) return { error: 'Couldn’t update the partner.' };
    revalidatePath(PATH);
    return { notice: active ? 'Partner on.' : 'Partner paused.' };
  });
}
