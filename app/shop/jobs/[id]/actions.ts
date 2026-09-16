'use server';

import { revalidatePath } from 'next/cache';
import { fail, isUuid, ok, oneOf, text, type ActionState } from '@/app/shop/_lib/form';
import { requireRole } from '@/lib/auth';
import type { Enums } from '@/lib/db/database.types';
import { changeWorkOrderStatus } from '@/lib/domain/work-orders';
import { WORK_ORDER_STATUS } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

type Status = Enums<'work_order_status'>;
const STATUSES = Object.keys(WORK_ORDER_STATUS) as Status[];

function refreshJob(workOrderId: string) {
  revalidatePath(`/shop/jobs/${workOrderId}`);
  revalidatePath('/shop');
}

export async function moveStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('employee', 'admin');
  const workOrderId = formData.get('workOrderId');
  const to = oneOf(formData, 'to', STATUSES);
  if (!isUuid(workOrderId) || !to) return fail('Pick a valid status.');

  // Confirms the job is visible to this user under RLS before the domain call.
  const supabase = await createClient();
  const { data: job } = await supabase.from('work_orders').select('id').eq('id', workOrderId).maybeSingle();
  if (!job) return fail('Job not found.');

  const result = await changeWorkOrderStatus(workOrderId, to, viewer.userId);
  if (!result.ok) return fail(result.error);

  refreshJob(workOrderId);
  return ok(`Moved to ${WORK_ORDER_STATUS[to].label}.`);
}

export async function addNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('employee', 'admin');
  const workOrderId = formData.get('workOrderId');
  if (!isUuid(workOrderId)) return fail('That job link is broken.');
  const body = text(formData, 'body', { max: 2000, required: true });
  if (body.error || !body.value) return fail(body.error === 'required' ? 'Write the note first.' : `Note ${body.error}.`);
  const visibleToCustomer = formData.get('visibleToCustomer') === 'on';

  const supabase = await createClient();
  const { error } = await supabase
    .from('work_order_notes')
    .insert({ work_order_id: workOrderId, author_id: viewer.userId, body: body.value, internal: !visibleToCustomer });
  if (error) return fail('Couldn’t save the note. Try again.');

  refreshJob(workOrderId);
  return ok(visibleToCustomer ? 'Note saved — the customer can see it.' : 'Internal note saved.');
}

export async function requestPart(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('employee', 'admin');
  const workOrderId = formData.get('workOrderId');
  if (!isUuid(workOrderId)) return fail('That job link is broken.');
  const description = text(formData, 'description', { max: 300, required: true });
  if (description.error || !description.value) return fail(description.error === 'required' ? 'Say which part you need.' : `Description ${description.error}.`);

  const supabase = await createClient();
  const { error } = await supabase
    .from('part_requests')
    .insert({ work_order_id: workOrderId, requested_by: viewer.userId, description: description.value, status: 'requested' });
  if (error) return fail('Couldn’t send the request. Try again.');

  refreshJob(workOrderId);
  return ok('Part requested. The counter will order it.');
}
