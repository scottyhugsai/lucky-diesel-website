'use server';

import { revalidatePath } from 'next/cache';
import { checkbox, guard, number, requiredText, requiredUuid, type ActionState } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { ensureReferralCode } from '@/lib/marketing/core/referrals';
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
