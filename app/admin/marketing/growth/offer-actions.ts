'use server';

import { revalidatePath } from 'next/cache';
import { checkbox, dollarsToCents, guard, number, oneOf, requiredText, requiredUuid, shopDateTime, text, uuid, type ActionState } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { checkClaims } from '@/lib/marketing/core/compliance';
import { createAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/marketing/growth';

function copyCheck(fields: (string | null)[]): { block: string | null; warn: string | null } {
  const result = checkClaims(fields.filter(Boolean).join('\n'));
  const blocks = result.issues.filter((i) => i.severity === 'block');
  const warns = result.issues.filter((i) => i.severity === 'warn');
  return {
    block: blocks.length ? blocks.map((i) => `“${i.match}”: ${i.reason}`).join(' ') : null,
    warn: warns.length ? warns.map((i) => `“${i.match}”`).join(', ') : null,
  };
}

export async function createOffer(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const code = requiredText(form, 'code', 'Code', 32).toUpperCase().replace(/\s+/g, '-');
    if (!/^[A-Z0-9-]{3,32}$/.test(code)) return { error: 'Code: 3–32 letters, numbers or dashes.' };
    const name = requiredText(form, 'name', 'Name', 120);
    const kind = oneOf(form, 'kind', ['percent', 'amount', 'free_service'] as const, 'type');
    const value = kind === 'percent'
      ? (number(form, 'value', { min: 1, max: 100, integer: true, required: true, label: 'Percent' }) as number)
      : (dollarsToCents(form, 'value', { required: true, label: 'Value', max: 10_000 }) as number);
    const terms = text(form, 'terms', { max: 500, label: 'Terms' });
    const description = text(form, 'description', { max: 300, label: 'Description' });
    const endsAt = shopDateTime(form, 'ends_at', 'Expiry');
    if (endsAt && new Date(endsAt) < new Date()) return { error: 'Expiry is in the past.' };
    const maxRedemptions = number(form, 'max_redemptions', { min: 1, max: 100_000, integer: true, label: 'Total limit' });
    const perCustomer = number(form, 'per_customer_limit', { min: 1, max: 100, integer: true, label: 'Per customer' }) ?? 1;
    const minSpend = dollarsToCents(form, 'min_spend', { label: 'Minimum spend' }) ?? 0;
    const segmentId = uuid(form, 'segment_id', { required: false, label: 'Segment' });

    const check = copyCheck([name, description, terms]);
    if (check.block) return { error: `Copy blocked. ${check.block}` };
    if (check.warn && !checkbox(form, 'ack')) return { error: `Check these words, then tick “Copy checked”: ${check.warn}.` };

    const { error } = await createAdminClient().from('offers').insert({
      code, name, kind, value, terms, description, ends_at: endsAt, starts_at: new Date().toISOString(), max_redemptions: maxRedemptions,
      per_customer_limit: perCustomer, min_spend_cents: minSpend, segment_id: segmentId,
    });
    if (error) return { error: error.code === '23505' ? 'That code is taken.' : 'Couldn’t save the offer.' };
    revalidatePath(PATH);
    return { notice: `${code} is live.` };
  });
}

export async function setOfferActive(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'offer_id', 'Offer');
    const active = checkbox(form, 'active');
    const { error } = await createAdminClient().from('offers').update({ active }).eq('id', id);
    if (error) return { error: 'Couldn’t update the offer.' };
    revalidatePath(PATH);
    return { notice: active ? 'Offer on.' : 'Offer paused.' };
  });
}
