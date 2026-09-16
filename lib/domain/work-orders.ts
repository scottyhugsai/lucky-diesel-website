import 'server-only';
import { emit } from '@/lib/automations/engine';
import type { Enums } from '@/lib/db/database.types';
import { NEXT_STATUSES } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeTotals } from '@/lib/work-orders/totals';

type Status = Enums<'work_order_status'>;

export type DomainResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Moves a job to a new status if the pipeline allows it, stamps start/finish
 * times, logs who did it and fires `work_order.status:<status>` automations.
 * Callers must have already checked the actor may touch this job.
 */
export async function changeWorkOrderStatus(workOrderId: string, to: Status, actorId: string, note?: string): Promise<DomainResult> {
  // Billing states are only reachable through createInvoice / recordPayment, which create the matching records.
  if (to === 'invoiced' || to === 'paid') return { ok: false, error: 'Use Create invoice or Record payment for billing.' };

  const db = createAdminClient();
  const { data: wo, error } = await db.from('work_orders').select('status, started_at').eq('id', workOrderId).maybeSingle();
  if (error || !wo) return { ok: false, error: 'Job not found.' };
  if (wo.status === to) return { ok: true, data: undefined };
  if (!NEXT_STATUSES[wo.status].includes(to)) return { ok: false, error: `Can’t move a job from ${wo.status.replace('_', ' ')} to ${to.replace('_', ' ')}.` };

  const now = new Date().toISOString();
  const patch: { status: Status; started_at?: string; completed_at?: string } = { status: to };
  if (to === 'in_progress' && !wo.started_at) patch.started_at = now;
  if (to === 'ready') patch.completed_at = now;

  const { error: updateError } = await db.from('work_orders').update(patch).eq('id', workOrderId);
  if (updateError) return { ok: false, error: updateError.message };

  // The status trigger logged the event without an actor (service role); attribute it.
  await db
    .from('work_order_events')
    .update({ actor_id: actorId, note: note ?? null })
    .eq('work_order_id', workOrderId)
    .eq('to_status', to)
    .is('actor_id', null)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString());

  await emit({ name: `work_order.status:${to}`, subjectType: 'work_order', subjectId: workOrderId, discriminator: now });
  return { ok: true, data: undefined };
}

/** Status triggers run as the service role; stamp who actually did it on the just-written events. */
export async function attributeRecentEvents(db: ReturnType<typeof createAdminClient>, workOrderId: string, actorId: string | null | undefined): Promise<void> {
  if (!actorId) return;
  await db
    .from('work_order_events')
    .update({ actor_id: actorId })
    .eq('work_order_id', workOrderId)
    .is('actor_id', null)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString());
}

/** Freezes approved lines into an invoice, marks the job invoiced and sends the pickup/pay message. */
export async function createInvoice(workOrderId: string, actorId: string): Promise<DomainResult<{ invoiceId: string }>> {
  const db = createAdminClient();
  const [{ data: wo }, { data: settings }, { data: existing }] = await Promise.all([
    db.from('work_orders').select('id, status, customer_id, line_items(*)').eq('id', workOrderId).maybeSingle(),
    db.from('shop_settings').select('tax_rate').eq('id', 1).maybeSingle(),
    db.from('invoices').select('id').eq('work_order_id', workOrderId).maybeSingle(),
  ]);
  if (!wo) return { ok: false, error: 'Job not found.' };
  if (existing) return { ok: true, data: { invoiceId: existing.id } };
  if (!['ready', 'quality_check', 'in_progress'].includes(wo.status)) return { ok: false, error: 'Finish the job before invoicing.' };

  const lines = (wo.line_items ?? []).filter((line) => line.approval === 'approved').sort((a, b) => a.sort - b.sort);
  if (!lines.length) return { ok: false, error: 'There are no approved items to invoice.' };
  const totals = computeTotals(lines, Number(settings?.tax_rate ?? 0));

  const { data: invoice, error } = await db
    .from('invoices')
    .insert({
      work_order_id: wo.id,
      customer_id: wo.customer_id,
      subtotal_cents: totals.subtotalCents,
      tax_cents: totals.taxCents,
      total_cents: totals.totalCents,
      line_snapshot: lines,
      due_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    })
    .select('id')
    .single();
  if (error || !invoice) return { ok: false, error: error?.message ?? 'Could not create invoice.' };

  if (wo.status !== 'ready') await db.from('work_orders').update({ status: 'ready', completed_at: new Date().toISOString() }).eq('id', wo.id);
  await db.from('work_orders').update({ status: 'invoiced' }).eq('id', wo.id);
  await attributeRecentEvents(db, wo.id, actorId);
  await db.from('audit_log').insert({ actor_id: actorId, entity: 'invoice', entity_id: invoice.id, action: 'created', data: { total_cents: totals.totalCents } });

  await emit({ name: 'invoice.created', subjectType: 'invoice', subjectId: invoice.id });
  return { ok: true, data: { invoiceId: invoice.id } };
}
