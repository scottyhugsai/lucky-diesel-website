'use server';

import { revalidatePath } from 'next/cache';
import { fail, isUuid, ok, str, TEMPLATE_MAX, numberIn, oneOf, type ActionState } from '@/components/admin/ops/form';
import { dispatchDue, emit } from '@/lib/automations/engine';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const KEY_PATTERN = /^[a-z0-9_]{1,64}$/;
const DAY_MS = 86_400_000;
const MAX_DELAY_MINUTES = 90 * 24 * 60;
const UNIT_MINUTES = { minutes: 1, hours: 60, days: 1440 } as const;

export interface DemoState extends ActionState {
  summary?: { processed: number; sent: number; skipped: number; failed: number };
}

function refresh(key?: string) {
  revalidatePath('/admin/automations');
  revalidatePath('/admin/automations/runs');
  revalidatePath('/admin/messages');
  revalidatePath('/admin/leads', 'layout');
  if (key) revalidatePath(`/admin/automations/${key}`);
}

export async function toggleAutomation(key: string, enabled: boolean): Promise<ActionState> {
  await requireRole('admin');
  if (!KEY_PATTERN.test(key) || typeof enabled !== 'boolean') return fail('Unknown automation.');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('automations')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('key', key)
    .select('name')
    .maybeSingle();
  if (error || !data) return fail('Couldn’t update that automation. Try again.');
  refresh(key);
  return ok(`${data.name} is ${enabled ? 'on' : 'off'}.`);
}

function template(formData: FormData, key: string): { value: string | null; tooLong: boolean } {
  const value = str(formData, key);
  return { value: value || null, tooLong: value.length > TEMPLATE_MAX };
}

export async function saveAutomation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const key = str(formData, 'key');
  if (!KEY_PATTERN.test(key)) return fail('Unknown automation.');

  const supabase = await createClient();
  const { data: current } = await supabase.from('automations').select('channels, name').eq('key', key).maybeSingle();
  if (!current) return fail('Automation not found.');

  const sms = template(formData, 'sms_template');
  const subject = template(formData, 'email_subject_template');
  const body = template(formData, 'email_body_template');
  if (sms.tooLong || body.tooLong) return fail(`Templates must be ${TEMPLATE_MAX} characters or fewer.`);
  if ((subject.value?.length ?? 0) > 200) return fail('Keep the email subject under 200 characters.');
  if (current.channels.includes('sms') && !sms.value) return fail('The text message can’t be empty.');
  if (current.channels.includes('email') && (!subject.value || !body.value)) return fail('The email needs a subject and a body.');

  const amount = numberIn(formData, 'delay_amount', 0, 100_000, { integer: true });
  const unit = oneOf(formData.get('delay_unit'), ['minutes', 'hours', 'days'] as const);
  if (amount === null || !unit) return fail('Enter a whole-number delay.');
  const delayMinutes = amount * UNIT_MINUTES[unit];
  if (delayMinutes > MAX_DELAY_MINUTES) return fail('Delays can be at most 90 days.');

  const { error } = await supabase
    .from('automations')
    .update({
      sms_template: current.channels.includes('sms') ? sms.value : null,
      email_subject_template: current.channels.includes('email') ? subject.value : null,
      email_body_template: current.channels.includes('email') ? body.value : null,
      delay_minutes: delayMinutes,
      updated_at: new Date().toISOString(),
    })
    .eq('key', key);
  if (error) return fail('Couldn’t save. Try again.');
  refresh(key);
  return ok(`Saved. New ${current.name.toLowerCase()} messages use this wording.`);
}

export async function runDueNow(): Promise<DemoState> {
  await requireRole('admin');
  const summary = await dispatchDue({ limit: 100 });
  refresh();
  return { ...ok(summary.processed ? 'Ran everything that was due.' : 'Nothing was due yet.'), summary };
}

export async function fastForward(_prev: DemoState, formData: FormData): Promise<DemoState> {
  await requireRole('admin');
  const days = numberIn(formData, 'days', 1, 7, { integer: true });
  if (days === null) return fail('Pick 1 to 7 days.');
  const summary = await dispatchDue({ now: new Date(Date.now() + days * DAY_MS), limit: 100 });
  refresh();
  return { ...ok(`Fast-forwarded ${days} day${days === 1 ? '' : 's'}.`), summary };
}

export async function sendDailySummary(): Promise<DemoState> {
  await requireRole('admin');
  const { scheduled } = await emit({ name: 'daily.summary', subjectType: 'shop', subjectId: null, discriminator: new Date().toISOString() });
  refresh();
  return scheduled ? ok('Daily summary sent to the owner inbox.') : fail('The daily summary automation is turned off.');
}

export async function simulateServiceDue(_prev: DemoState, formData: FormData): Promise<DemoState> {
  await requireRole('admin');
  const customerId = formData.get('customer_id');
  const vehicleId = formData.get('vehicle_id');
  if (!isUuid(customerId) || !isUuid(vehicleId)) return fail('Pick a customer and one of their trucks.');

  const supabase = await createClient();
  const { data: vehicle } = await supabase.from('vehicles').select('id').eq('id', vehicleId).eq('customer_id', customerId).maybeSingle();
  if (!vehicle) return fail('That truck doesn’t belong to that customer.');

  const { scheduled } = await emit({
    name: 'service.due',
    subjectType: 'customer',
    subjectId: customerId,
    context: { vehicle_id: vehicleId, due_service: 'an oil change and fuel filters' },
    discriminator: Date.now().toString(),
  });
  refresh();
  return scheduled ? ok('Service-due reminder fired. Check the Demo Phone.') : fail('The service due automation is turned off.');
}
