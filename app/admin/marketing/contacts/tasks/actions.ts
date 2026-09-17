'use server';

import { revalidatePath } from 'next/cache';
import { fail, isUuid, numberIn, ok, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const TASKS = '/admin/marketing/contacts/tasks';
const MAX_SNOOZE_HOURS = 720;

function refresh(): void {
  revalidatePath(TASKS);
  revalidatePath('/admin/marketing/contacts/pipeline');
}

/** Marks the lead as reached, which clears its speed-to-lead clock. */
export async function markContactedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'lead_id');
  if (!isUuid(id)) return fail('Unknown lead.');
  const db = createAdminClient();
  const { data: lead } = await db.from('leads').select('status, contacted_at').eq('id', id).maybeSingle();
  if (!lead) return fail('Lead not found.');
  const now = new Date().toISOString();
  const { error } = await db.from('leads')
    .update({ contacted_at: lead.contacted_at ?? now, last_activity_at: now, status: lead.status === 'new' ? 'contacted' : lead.status })
    .eq('id', id);
  if (error) return fail('Could not save that.');
  refresh();
  return ok('Marked as reached.');
}

/** Hides the lead from the list until later (a follow-up reminder fires when it ends). */
export async function snoozeLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'lead_id');
  if (!isUuid(id)) return fail('Unknown lead.');
  const hours = numberIn(formData, 'hours', 0, MAX_SNOOZE_HOURS, { integer: true });
  if (hours === null) return fail('Pick a time.');
  const until = hours === 0 ? null : new Date(Date.now() + hours * 3_600_000).toISOString();
  const { error } = await createAdminClient().from('leads').update({ snoozed_until: until }).eq('id', id);
  if (error) return fail('Could not save that.');
  refresh();
  return ok(until ? 'Snoozed.' : 'Snooze cleared.');
}

/** Gives the lead an owner so it shows up in their list. */
export async function assignLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'lead_id');
  if (!isUuid(id)) return fail('Unknown lead.');
  const assignee = str(formData, 'assigned_to');
  if (assignee && !isUuid(assignee)) return fail('Pick someone.');
  const { error } = await createAdminClient().from('leads').update({ assigned_to: assignee || null }).eq('id', id);
  if (error) return fail('Could not save that.');
  refresh();
  return ok(assignee ? 'Assigned.' : 'Unassigned.');
}
