'use server';

import { revalidatePath } from 'next/cache';
import { EMAIL_PATTERN, fail, numberIn, ok, oneOf, str, checked, type ActionState } from '@/components/admin/ops/form';
import { SEASONAL_TEMPLATES } from '@/components/admin/marketing/core-ui/seasonal';
import { requireRole } from '@/lib/auth';
import { findCustomerByAddress, recordConsent } from '@/lib/marketing/core/consent';
import { normalizeAddress } from '@/lib/marketing/core/policy';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const PATH = '/admin/marketing/settings';
const MAX_LIST = 30;
const TIME_ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'] as const;

function refresh() {
  revalidatePath(PATH);
  revalidatePath('/admin/marketing');
}

export async function saveSendingRulesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const smsCap = numberIn(formData, 'sms_max_per_week', 0, 14, { integer: true });
  const emailCap = numberIn(formData, 'email_max_per_week', 0, 14, { integer: true });
  const quietStart = numberIn(formData, 'quiet_hours_start', 0, 23, { integer: true });
  const quietEnd = numberIn(formData, 'quiet_hours_end', 0, 23, { integer: true });
  const timeZone = oneOf(formData.get('time_zone'), TIME_ZONES);
  if (smsCap === null || emailCap === null) return fail('Caps must be 0–14 per week.');
  if (quietStart === null || quietEnd === null || quietStart <= quietEnd) return fail('Quiet hours must start in the evening and end in the morning.');
  if (quietStart > 21 || quietEnd < 8) return fail('Keep marketing between 8am and 9pm (TCPA).');
  if (!timeZone) return fail('Pick a time zone.');

  const senderName = str(formData, 'sender_name');
  const smsName = str(formData, 'sms_business_name');
  const senderEmail = str(formData, 'sender_email').toLowerCase();
  const replyTo = str(formData, 'reply_to_email').toLowerCase();
  const postal = str(formData, 'postal_address');
  if (!senderName || senderName.length > 80 || !smsName || smsName.length > 40) return fail('Sender and SMS names are required (80 / 40 max).');
  if ((senderEmail && !EMAIL_PATTERN.test(senderEmail)) || (replyTo && !EMAIL_PATTERN.test(replyTo))) return fail('Enter valid email addresses.');
  if (!postal || postal.length > 200) return fail('A postal address is required for CAN-SPAM.');

  const supabase = await createClient();
  const { error } = await supabase.from('marketing_settings').upsert({
    id: 1, sms_max_per_week: smsCap, email_max_per_week: emailCap, quiet_hours_start: quietStart, quiet_hours_end: quietEnd, time_zone: timeZone,
    sender_name: senderName, sms_business_name: smsName, sender_email: senderEmail || null, reply_to_email: replyTo || null, postal_address: postal,
  });
  if (error) return fail(`Could not save: ${error.message}`);
  refresh();
  return ok('Sending rules saved.');
}

export async function saveSeasonalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const keys = SEASONAL_TEMPLATES.flatMap((t) => (t.toggle ? [t.toggle] : []));
  const toggles = Object.fromEntries(keys.map((key) => [key, checked(formData, `season_${key}`)]));
  const supabase = await createClient();
  const { error } = await supabase.from('marketing_settings').update({ seasonal_toggles: toggles }).eq('id', 1);
  if (error) return fail('Could not save seasonal toggles.');
  refresh();
  revalidatePath('/admin/marketing/campaigns/seasonal');
  return ok('Seasonal plays saved.');
}

function lines(formData: FormData, key: string, max = 160): string[] | null {
  const items = str(formData, key).split('\n').map((l) => l.trim()).filter(Boolean);
  if (items.length > MAX_LIST || items.some((l) => l.length > max)) return null;
  return [...new Set(items)];
}

export async function saveBrandVoiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const tone = str(formData, 'tone');
  const cta = str(formData, 'default_cta');
  if (!tone || tone.length > 300) return fail('Describe the tone (max 300 characters).');
  if (!cta || cta.length > 40) return fail('Default call to action is required (max 40).');
  const doRules = lines(formData, 'do_rules');
  const dontRules = lines(formData, 'dont_rules');
  const banned = lines(formData, 'banned_phrases', 60);
  const claims = lines(formData, 'approved_claims');
  const hashtags = lines(formData, 'hashtags', 40);
  if (!doRules || !dontRules || !banned || !claims || !hashtags) return fail(`Lists allow ${MAX_LIST} short lines each.`);
  if (hashtags.some((h) => !/^#[A-Za-z0-9_]+$/.test(h))) return fail('Hashtags start with # and use letters or numbers.');

  const supabase = await createClient();
  const { error } = await supabase.from('brand_voice').upsert({
    id: 1, tone, default_cta: cta, do_rules: doRules, dont_rules: dontRules, banned_phrases: banned.map((b) => b.toLowerCase()), approved_claims: claims, hashtags,
    updated_at: new Date().toISOString(),
  });
  if (error) return fail(`Could not save: ${error.message}`);
  refresh();
  return ok('Brand voice saved.');
}

export async function addSuppressionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const channel = oneOf(formData.get('channel'), ['sms', 'email'] as const);
  const reason = oneOf(formData.get('reason'), ['dnc', 'manual', 'complaint', 'bounce', 'stop'] as const);
  const address = str(formData, 'address');
  if (!channel || !reason) return fail('Pick a channel and reason.');
  if (channel === 'email' && !EMAIL_PATTERN.test(address)) return fail('Enter a valid email.');
  if (channel === 'sms' && address.replace(/\D/g, '').length < 10) return fail('Enter a 10-digit phone number.');
  const normalized = normalizeAddress(channel, address);
  if (!normalized) return fail('That address isn’t valid.');

  const db = createAdminClient();
  const customerId = await findCustomerByAddress(db, channel, normalized);
  const result = await recordConsent(db, {
    customerId, channel, purpose: 'marketing', action: 'revoked', method: reason === 'manual' ? 'owner' : reason, address: normalized, evidence: { text: `Suppressed by owner: ${reason}` },
  });
  if (!result.ok) return fail(result.error ?? 'Could not suppress.');
  refresh();
  return ok(`${normalized} won’t get marketing.`);
}

export async function removeSuppressionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('Unknown entry.');
  const supabase = await createClient();
  const { data: row } = await supabase.from('suppressions').select('reason, scope').eq('id', id).maybeSingle();
  if (!row) return fail('Already removed.');
  if (row.scope === 'all' || row.reason === 'keyword_stop' || row.reason === 'stop') return fail('STOP opt-outs can only be lifted by the customer texting START.');
  const { error } = await supabase.from('suppressions').delete().eq('id', id);
  if (error) return fail('Could not remove.');
  refresh();
  return ok('Removed. They still need consent to get marketing.');
}
