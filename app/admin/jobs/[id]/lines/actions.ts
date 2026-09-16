'use server';

import { revalidatePath } from 'next/cache';
import {
  type ActionState, InputError, checkbox, dollarsToCents, guard, number, oneOf, requiredText, requiredUuid, uuid,
} from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { cancelScheduled } from '@/lib/automations/engine';
import { createClient } from '@/lib/supabase/server';

const LOCKED: string[] = ['invoiced', 'paid', 'cancelled'];

async function editableJob(workOrderId: string) {
  const db = await createClient();
  const { data: wo } = await db.from('work_orders').select('status').eq('id', workOrderId).maybeSingle();
  if (!wo) throw new InputError('Job not found.');
  if (LOCKED.includes(wo.status)) throw new InputError('This job is invoiced. Its lines are locked.');
  return db;
}

function refresh(id: string) {
  revalidatePath(`/admin/jobs/${id}`);
  revalidatePath('/admin/jobs');
}

export async function saveLine(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const workOrderId = requiredUuid(form, 'work_order_id', 'Job');
    const lineId = uuid(form, 'line_id', { required: false, label: 'Line' });
    const kind = oneOf(form, 'kind', ['labor', 'part', 'fee'] as const, 'line type');
    const unitCost = dollarsToCents(form, 'unit_cost', { label: 'Unit cost' });
    const row = {
      kind,
      description: requiredText(form, 'description', 'Description', 200),
      quantity: number(form, 'quantity', { min: 0.01, max: 1000, required: true, label: kind === 'labor' ? 'Hours' : 'Quantity' }) as number,
      unit_price_cents: dollarsToCents(form, 'unit_price', { required: true, label: kind === 'labor' ? 'Rate' : 'Unit price' }) as number,
      unit_cost_cents: unitCost,
      taxable: checkbox(form, 'taxable'),
      approval: oneOf(form, 'approval', ['pending', 'approved', 'declined'] as const, 'approval state'),
    };
    const db = await editableJob(workOrderId);

    if (lineId) {
      const { error } = await db.from('line_items').update(row).eq('id', lineId).eq('work_order_id', workOrderId);
      if (error) return { error: `Could not save line: ${error.message}` };
      refresh(workOrderId);
      return { notice: 'Line saved.' };
    }

    const { data: last } = await db.from('line_items').select('sort').eq('work_order_id', workOrderId).order('sort', { ascending: false }).limit(1);
    const { error } = await db.from('line_items').insert({ ...row, work_order_id: workOrderId, sort: (last?.[0]?.sort ?? -1) + 1 });
    if (error) return { error: `Could not add line: ${error.message}` };
    refresh(workOrderId);
    return { notice: 'Line added.' };
  });
}

export async function removeLine(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const workOrderId = requiredUuid(form, 'work_order_id', 'Job');
    const lineId = requiredUuid(form, 'line_id', 'Line');
    const db = await editableJob(workOrderId);
    const { error } = await db.from('line_items').delete().eq('id', lineId).eq('work_order_id', workOrderId);
    if (error) return { error: `Could not remove line: ${error.message}` };
    refresh(workOrderId);
    return { notice: 'Line removed.' };
  });
}

export async function moveLine(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const workOrderId = requiredUuid(form, 'work_order_id', 'Job');
    const lineId = requiredUuid(form, 'line_id', 'Line');
    const direction = oneOf(form, 'direction', ['up', 'down'] as const, 'direction');
    const db = await editableJob(workOrderId);

    const { data: lines, error } = await db.from('line_items').select('id, sort, created_at').eq('work_order_id', workOrderId).order('sort').order('created_at');
    if (error || !lines) return { error: 'Could not load lines.' };
    const ids = lines.map((l) => l.id);
    const from = ids.indexOf(lineId);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= ids.length) return {};

    const reordered = ids.map((id, index) => (index === from ? ids[to]! : index === to ? ids[from]! : id));
    // Renumber every line so duplicate sort values from older data can't make moves stick.
    const updates = reordered
      .map((id, sort) => ({ id, sort }))
      .filter(({ id, sort }) => lines.find((l) => l.id === id)?.sort !== sort)
      .map(({ id, sort }) => db.from('line_items').update({ sort }).eq('id', id).eq('work_order_id', workOrderId));
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) return { error: `Could not reorder: ${failed.error.message}` };
    refresh(workOrderId);
    return {};
  });
}

export async function setAllPending(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const workOrderId = requiredUuid(form, 'work_order_id', 'Job');
    const approval = oneOf(form, 'approval', ['approved', 'declined'] as const, 'approval state');
    const db = await editableJob(workOrderId);
    const { error } = await db.from('line_items').update({ approval }).eq('work_order_id', workOrderId).eq('approval', 'pending');
    if (error) return { error: `Could not update lines: ${error.message}` };
    // The shop recorded the decision, so the customer shouldn't get an approval nudge.
    await cancelScheduled('work_order', workOrderId, ['estimate_nudge']);
    await db.from('work_order_notes').insert({ work_order_id: workOrderId, author_id: viewer.userId, body: `All pending lines marked ${approval} by the shop (verbal/in-person decision).`, internal: true });
    refresh(workOrderId);
    return { notice: `Pending lines marked ${approval}.` };
  });
}
