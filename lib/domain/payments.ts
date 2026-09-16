import 'server-only';
import { emit } from '@/lib/automations/engine';
import { createAdminClient } from '@/lib/supabase/admin';
import type { DomainResult } from './work-orders';

/**
 * Records full payment of an invoice (card via Stripe webhook, cash/check at
 * the counter, or the demo checkout). Idempotent per Stripe payment intent.
 */
export async function recordPayment(
  invoiceId: string,
  method: 'card' | 'cash' | 'check' | 'demo',
  options: { stripePaymentIntentId?: string; actorId?: string | null } = {},
): Promise<DomainResult> {
  const db = createAdminClient();
  const { data: invoice } = await db.from('invoices').select('id, status, total_cents, work_order_id').eq('id', invoiceId).maybeSingle();
  if (!invoice) return { ok: false, error: 'Invoice not found.' };
  if (invoice.status === 'paid') return { ok: true, data: undefined };
  if (invoice.status === 'void') return { ok: false, error: 'This invoice was voided.' };

  if (options.stripePaymentIntentId) {
    const { data: duplicate } = await db.from('payments').select('id').eq('stripe_payment_intent_id', options.stripePaymentIntentId).maybeSingle();
    if (duplicate) return { ok: true, data: undefined };
  }

  const paidAt = new Date().toISOString();
  const { error } = await db.from('payments').insert({
    invoice_id: invoice.id,
    amount_cents: invoice.total_cents,
    method,
    stripe_payment_intent_id: options.stripePaymentIntentId ?? null,
  });
  if (error) return { ok: false, error: error.message };

  await db.from('invoices').update({ status: 'paid', paid_at: paidAt }).eq('id', invoice.id).neq('status', 'paid');
  await db.from('work_orders').update({ status: 'paid' }).eq('id', invoice.work_order_id);
  await db.from('audit_log').insert({ actor_id: options.actorId ?? null, entity: 'invoice', entity_id: invoice.id, action: 'paid', data: { method, amount_cents: invoice.total_cents } });

  await emit({ name: 'invoice.paid', subjectType: 'invoice', subjectId: invoice.id });
  return { ok: true, data: undefined };
}
