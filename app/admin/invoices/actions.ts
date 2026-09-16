'use server';

import { revalidatePath } from 'next/cache';
import { type ActionState, InputError, guard, oneOf, requiredUuid } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { recordPayment } from '@/lib/domain/payments';
import { createClient } from '@/lib/supabase/server';

/** Counter payment (cash or check) for the full invoice balance. Card payments go through Stripe from the portal. */
export async function recordCounterPayment(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const invoiceId = requiredUuid(form, 'invoice_id', 'Invoice');
    const method = oneOf(form, 'method', ['cash', 'check'] as const, 'payment method');
    const db = await createClient();
    const { data: invoice } = await db.from('invoices').select('id, status, work_order_id').eq('id', invoiceId).maybeSingle();
    if (!invoice) throw new InputError('Invoice not found.');
    if (invoice.status === 'paid') throw new InputError('This invoice is already paid.');

    const result = await recordPayment(invoiceId, method, { actorId: viewer.userId });
    if (!result.ok) return { error: result.error };

    revalidatePath('/admin/invoices');
    revalidatePath(`/admin/invoices/${invoiceId}`);
    revalidatePath(`/admin/jobs/${invoice.work_order_id}`);
    revalidatePath('/admin/jobs');
    revalidatePath('/admin');
    return { notice: `Paid by ${method}. Receipt and review request are on their way.` };
  });
}
