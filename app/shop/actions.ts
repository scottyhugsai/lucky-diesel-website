'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fail, isUuid, ok, type ActionState } from './_lib/form';

const UNIQUE_VIOLATION = '23505';

function refresh(workOrderId?: string) {
  revalidatePath('/shop');
  revalidatePath('/shop/time');
  if (workOrderId) revalidatePath(`/shop/jobs/${workOrderId}`);
}

async function openEntryLabel(supabase: Awaited<ReturnType<typeof createClient>>, techId: string): Promise<string | null> {
  const { data } = await supabase
    .from('time_entries')
    .select('work_orders(number)')
    .eq('tech_id', techId)
    .is('ended_at', null)
    .maybeSingle();
  return data?.work_orders?.number ? `WO #${data.work_orders.number}` : null;
}

export async function clockIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('employee', 'admin');
  const workOrderId = formData.get('workOrderId');
  if (!isUuid(workOrderId)) return fail('That job link is broken. Go back to My jobs.');

  const supabase = await createClient();
  const { data: job } = await supabase.from('work_orders').select('status').eq('id', workOrderId).maybeSingle();
  if (!job) return fail('Job not found.');
  if (['invoiced', 'paid', 'cancelled'].includes(job.status)) return fail('This job is closed. Time can’t be added to it.');

  const { error } = await supabase.from('time_entries').insert({ work_order_id: workOrderId, tech_id: viewer.userId });
  if (error?.code === UNIQUE_VIOLATION) {
    const label = await openEntryLabel(supabase, viewer.userId);
    return fail(`You’re clocked into ${label ?? 'another job'} — clock out first.`);
  }
  if (error) return fail('Couldn’t clock in. Try again.');

  refresh(workOrderId);
  return ok('Clocked in. Timer running.');
}

export async function clockOut(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('employee', 'admin');
  const entryId = formData.get('entryId');
  if (!isUuid(entryId)) return fail('No open time entry.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('time_entries')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', entryId)
    .eq('tech_id', viewer.userId)
    .is('ended_at', null)
    .select('work_order_id')
    .maybeSingle();
  if (error) return fail('Couldn’t clock out. Try again.');
  if (!data) return fail('You were already clocked out.');

  refresh(data.work_order_id);
  return ok('Clocked out.');
}

/** Clocks out of whatever job is open and into this one, in one tap. */
export async function switchClock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('employee', 'admin');
  const workOrderId = formData.get('workOrderId');
  if (!isUuid(workOrderId)) return fail('That job link is broken.');

  const supabase = await createClient();
  const { data: closed, error: closeError } = await supabase
    .from('time_entries')
    .update({ ended_at: new Date().toISOString() })
    .eq('tech_id', viewer.userId)
    .is('ended_at', null)
    .select('work_order_id');
  if (closeError) return fail('Couldn’t clock out of the other job.');

  const result = await clockIn({}, formData);
  for (const entry of closed ?? []) revalidatePath(`/shop/jobs/${entry.work_order_id}`);
  return result.error ? result : ok('Switched jobs. Timer running here.');
}

export async function takeJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('employee', 'admin');
  const workOrderId = formData.get('workOrderId');
  if (!isUuid(workOrderId)) return fail('That job link is broken.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('work_orders')
    .update({ assigned_tech_id: viewer.userId })
    .eq('id', workOrderId)
    .is('assigned_tech_id', null)
    .select('number')
    .maybeSingle();
  if (error) return fail('Couldn’t take the job. Try again.');
  if (!data) return fail('Someone already grabbed that one.');

  refresh(workOrderId);
  return ok(`WO #${data.number} is yours.`);
}
