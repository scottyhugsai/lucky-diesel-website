'use server';

import { revalidatePath } from 'next/cache';
import { EMAIL_PATTERN, checked, fail, formatPhone, isUuid, ok, oneOf, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import { sendMessage } from '@/lib/messaging/send';
import { createClient } from '@/lib/supabase/server';

/** Who gets owner alerts. Admin only; every field from the browser is untrusted. */

const INTENTS = ['save', 'remove', 'test'] as const;
const MAX_LABEL = 80;
const MAX_RECIPIENTS = 20;

interface RecipientInput {
  label: string;
  email: string | null;
  phone: string | null;
  notify_email: boolean;
  notify_sms: boolean;
  active: boolean;
  sort: number;
}

function parse(formData: FormData): RecipientInput | string {
  const label = str(formData, 'label').slice(0, MAX_LABEL);
  if (label.length < 2) return 'Give this person a name, e.g. “Scotty — developer”.';

  const email = str(formData, 'email').toLowerCase();
  if (email && (!EMAIL_PATTERN.test(email) || email.length > 254)) return 'Enter a valid email address.';

  const rawPhone = str(formData, 'phone');
  const phone = rawPhone ? formatPhone(rawPhone) : null;
  if (rawPhone && !phone) return 'The mobile number must be 10 digits.';
  if (!email && !phone) return 'Add an email address, a mobile number, or both.';

  const notifyEmail = checked(formData, 'notify_email');
  const notifySms = checked(formData, 'notify_sms');
  if (!(notifyEmail && email) && !(notifySms && phone)) return 'Turn on at least one channel this person has an address for.';

  const sort = Number(str(formData, 'sort'));
  return {
    label,
    email: email || null,
    phone,
    notify_email: notifyEmail,
    notify_sms: notifySms,
    active: checked(formData, 'active'),
    sort: Number.isInteger(sort) && sort >= 0 && sort <= 999 ? sort : 0,
  };
}

async function sendTest(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data: row } = await supabase.from('owner_recipients').select('*').eq('id', id).maybeSingle();
  if (!row) return fail('That recipient no longer exists.');

  const results: string[] = [];
  if (row.notify_email && row.email) {
    const result = await sendMessage({
      channel: 'email', to: row.email, automationKey: 'owner_recipient_test', purpose: 'transactional',
      subject: 'Lucky Diesel — test alert',
      body: `This is a test owner alert for ${row.label}. Real alerts (new lead, booking, approval, daily summary) go to this address the same way.`,
    });
    results.push(`Email ${result.status}${result.error ? ` — ${result.error}` : ''}`);
  }
  if (row.notify_sms && row.phone) {
    const result = await sendMessage({
      channel: 'sms', to: row.phone, automationKey: 'owner_recipient_test', purpose: 'transactional',
      body: `Lucky Diesel test alert for ${row.label}. Real owner alerts arrive the same way.`,
    });
    results.push(`SMS ${result.status}${result.error ? ` — ${result.error}` : ''}`);
  }
  if (!results.length) return fail('No channel is switched on for this person.');
  revalidatePath('/admin/settings');
  return ok(`${results.join(' · ')}. Every send is logged in Messages.`);
}

/** Add, edit, remove or test one recipient. The button pressed sets `intent`. */
export async function recipientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');

  const intent = oneOf(formData.get('intent'), INTENTS);
  if (!intent) return fail('Unknown action.');
  const rawId = str(formData, 'id');
  const id = rawId ? (isUuid(rawId) ? rawId : null) : null;
  if (rawId && !id) return fail('Unknown recipient.');

  if (intent === 'test') {
    if (!id) return fail('Save this person before sending a test.');
    return sendTest(id);
  }

  const supabase = await createClient();

  if (intent === 'remove') {
    if (!id) return fail('Unknown recipient.');
    const { error } = await supabase.from('owner_recipients').delete().eq('id', id);
    if (error) return fail('Couldn’t remove that recipient. Try again.');
    revalidatePath('/admin/settings');
    return ok('Recipient removed.');
  }

  const parsed = parse(formData);
  if (typeof parsed === 'string') return fail(parsed);

  if (id) {
    const { error } = await supabase.from('owner_recipients').update(parsed).eq('id', id);
    if (error) return fail('Couldn’t save that recipient. Try again.');
    revalidatePath('/admin/settings');
    return ok('Recipient saved.');
  }

  const { count } = await supabase.from('owner_recipients').select('id', { count: 'exact', head: true });
  if ((count ?? 0) >= MAX_RECIPIENTS) return fail(`That’s the limit of ${MAX_RECIPIENTS} recipients.`);
  const { error } = await supabase.from('owner_recipients').insert({ ...parsed, sort: count ?? 0 });
  if (error) return fail('Couldn’t add that recipient. Try again.');
  revalidatePath('/admin/settings');
  return ok(`${parsed.label} will now get owner alerts.`);
}
