'use server';

import { revalidatePath } from 'next/cache';
import { type ActionState, InputError, guard, oneOf, requiredText, requiredUuid, checkbox } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { cancelScheduled, emit } from '@/lib/automations/engine';
import type { Enums } from '@/lib/db/database.types';
import { changeWorkOrderStatus, createInvoice } from '@/lib/domain/work-orders';
import { WORK_ORDER_STATUS } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

type Status = Enums<'work_order_status'>;
const STATUSES = Object.keys(WORK_ORDER_STATUS) as Status[];

function refresh(id: string) {
  revalidatePath(`/admin/jobs/${id}`);
  revalidatePath('/admin/jobs');
  revalidatePath('/admin');
}

export async function changeStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'work_order_id', 'Job');
    const to = oneOf(form, 'to', STATUSES, 'status');
    // Invoicing and payment have their own flows that freeze totals and send the right messages.
    if (to === 'invoiced') throw new InputError('Use “Create invoice” to invoice this job.');
    if (to === 'paid') throw new InputError('Record a payment to mark this job paid.');
    const result = await changeWorkOrderStatus(id, to, viewer.userId);
    if (!result.ok) return { error: result.error };
    // Once a job leaves "awaiting approval" the 4-hour approval nudge no longer applies.
    if (to !== 'awaiting_approval') await cancelScheduled('work_order', id, ['estimate_nudge']);
    refresh(id);
    return { notice: `Moved to ${WORK_ORDER_STATUS[to].label}.` };
  });
}

export async function sendEstimate(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'work_order_id', 'Job');
    const db = await createClient();
    const [{ data: wo }, { count: pending }] = await Promise.all([
      db.from('work_orders').select('status').eq('id', id).maybeSingle(),
      db.from('line_items').select('id', { count: 'exact', head: true }).eq('work_order_id', id).eq('approval', 'pending'),
    ]);
    if (!wo) throw new InputError('Job not found.');
    if (wo.status !== 'estimate') throw new InputError('Only jobs in Estimate can be sent for approval.');
    if (!pending) throw new InputError('Add at least one pending line before sending the estimate.');

    const moved = await changeWorkOrderStatus(id, 'awaiting_approval', viewer.userId, 'Estimate sent for approval');
    if (!moved.ok) return { error: moved.error };

    // A drafted inspection goes out with the estimate so the customer sees the photos.
    await db.from('inspections').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('work_order_id', id).eq('status', 'draft');
    await emit({ name: 'inspection.sent', subjectType: 'work_order', subjectId: id, discriminator: new Date().toISOString() });
    refresh(id);
    return { notice: 'Estimate sent. The customer gets a text and email with the approval link.' };
  });
}

export async function createInvoiceForJob(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'work_order_id', 'Job');
    const result = await createInvoice(id, viewer.userId);
    if (!result.ok) return { error: result.error };
    refresh(id);
    revalidatePath('/admin/invoices');
    return { notice: 'Invoice created and pickup message sent.' };
  });
}

export async function addNote(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'work_order_id', 'Job');
    const body = requiredText(form, 'body', 'Note', 2000);
    const visibleToCustomer = checkbox(form, 'customer_visible');
    const db = await createClient();
    const { error } = await db.from('work_order_notes').insert({ work_order_id: id, author_id: viewer.userId, body, internal: !visibleToCustomer });
    if (error) return { error: `Could not add note: ${error.message}` };
    revalidatePath(`/admin/jobs/${id}`);
    return { notice: visibleToCustomer ? 'Note added. The customer can see it in their portal.' : 'Internal note added.' };
  });
}

export async function updatePartRequest(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'part_request_id', 'Part request');
    const workOrderId = requiredUuid(form, 'work_order_id', 'Job');
    const status = oneOf(form, 'status', ['requested', 'ordered', 'received'] as const, 'part status');
    const db = await createClient();
    const { error } = await db.from('part_requests').update({ status }).eq('id', id).eq('work_order_id', workOrderId);
    if (error) return { error: `Could not update part: ${error.message}` };
    refresh(workOrderId);
    return { notice: `Marked ${status}.` };
  });
}
