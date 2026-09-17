'use server';

import { revalidatePath } from 'next/cache';
import { type ActionState, checkbox, guard, InputError, number, oneOf, requiredText, requiredUuid, text } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { applyInvoiceDiscount, removeInvoiceDiscount, type DiscountInput } from '@/lib/marketing/core/redemption';

const KINDS = ['offer', 'points', 'referral', 'military', 'fleet', 'tier'] as const;

function refresh(invoiceId: string): void {
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath('/admin/invoices');
  revalidatePath(`/portal/invoices/${invoiceId}`);
}

/** Applies one discount. Amounts are always computed server-side from the invoice. */
export async function applyDiscount(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const invoiceId = requiredUuid(form, 'invoice_id', 'Invoice');
    const kind = oneOf(form, 'kind', KINDS, 'discount');
    let input: DiscountInput;
    if (kind === 'offer') {
      const code = requiredText(form, 'code', 'Code', 32).toUpperCase();
      if (!/^[A-Z0-9-]{3,32}$/.test(code)) throw new InputError('Enter a valid code.');
      input = { kind, code };
    } else if (kind === 'points') {
      input = { kind, points: number(form, 'points', { min: 1, max: 1_000_000, integer: true, required: true, label: 'Points' }) as number };
    } else if (kind === 'military') {
      input = { kind, verified: checkbox(form, 'verified'), note: text(form, 'note', { max: 120, label: 'Note' }) };
    } else {
      input = { kind };
    }
    const result = await applyInvoiceDiscount(invoiceId, input, viewer.userId);
    if (!result.ok) return { error: result.error };
    refresh(invoiceId);
    return { notice: result.notice };
  });
}

export async function removeDiscount(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const invoiceId = requiredUuid(form, 'invoice_id', 'Invoice');
    const discountId = requiredUuid(form, 'discount_id', 'Discount');
    const result = await removeInvoiceDiscount(invoiceId, discountId, viewer.userId);
    if (!result.ok) return { error: result.error };
    refresh(invoiceId);
    return { notice: result.notice };
  });
}
