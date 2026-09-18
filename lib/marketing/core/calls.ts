import 'server-only';
import { ownerRecipients } from '@/lib/automations/owner-contacts';
import { sendMessage } from '@/lib/messaging/send';
import { renderTemplate } from '@/lib/messaging/template';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { findCustomerByAddress } from './consent';
import { normalizePhone } from './policy';
import { getMarketingSettings, type Db } from './settings';

/** Twilio CallStatus values that mean nobody picked up. */
export const MISSED_CALL_STATUSES = new Set(['no-answer', 'busy', 'failed', 'canceled']);
const TEXT_BACK_KEY = 'missed_call_text_back';

export interface VoiceStatusInput {
  callSid: string;
  from: string;
  to: string | null;
  callStatus: string;
  /** Dial outcome when the call was forwarded with <Dial action>. */
  dialCallStatus?: string | null;
}

export interface MissedCallResult {
  missed: boolean;
  textedBack: boolean;
  detail: string;
}

/**
 * Handles a Twilio voice status callback. On a missed call it texts the caller
 * back immediately (simulated unless MESSAGING_SMS_MODE=live) using the owner's
 * editable `missed_call_text_back` template, and alerts the owner. Once per CallSid.
 */
export async function handleVoiceStatus(input: VoiceStatusInput, db: Db = createAdminClient()): Promise<MissedCallResult> {
  const status = (input.dialCallStatus || input.callStatus).toLowerCase();
  const from = normalizePhone(input.from);
  if (!MISSED_CALL_STATUSES.has(status)) return { missed: false, textedBack: false, detail: `call ${status}` };
  if (!from || from.length < 11) return { missed: true, textedBack: false, detail: 'no caller id' };

  const customerId = await findCustomerByAddress(db, 'sms', from);
  const { data: logged, error } = await db.from('marketing_call_events')
    .upsert({ call_sid: input.callSid, from_number: from, to_number: input.to, call_status: status, customer_id: customerId }, { onConflict: 'call_sid', ignoreDuplicates: true })
    .select('id');
  if (error) return { missed: true, textedBack: false, detail: `could not log call: ${error.message}` };
  if (!logged?.length) return { missed: true, textedBack: false, detail: 'already handled' };

  const [settings, { data: automation }] = await Promise.all([
    getMarketingSettings(db),
    db.from('automations').select('enabled, sms_template').eq('key', TEXT_BACK_KEY).maybeSingle(),
  ]);
  if (!settings.missedCallTextBack || automation?.enabled === false) return { missed: true, textedBack: false, detail: 'text-back turned off' };

  const vars = { booking_link: `${siteUrl()}/book`, shop_phone: BUSINESS.phoneDisplay };
  const template = automation?.sms_template ?? "Sorry we missed your call, this is Lucky Diesel. How can we help? Reply here or book online: {{booking_link}}";
  // A reply to someone who just called us is conversational, not marketing. STOP suppressions still apply in sendMessage.
  const result = await sendMessage({ channel: 'sms', to: from, body: renderTemplate(template, vars), customerId, automationKey: TEXT_BACK_KEY, purpose: 'transactional' });
  const textedBack = result.status === 'sent' || result.status === 'simulated';
  await db.from('marketing_call_events').update({ texted_back_at: textedBack ? new Date().toISOString() : null, message_id: result.messageId }).eq('call_sid', input.callSid);

  const alert = `Missed call from ${from}${customerId ? ' (existing customer)' : ''}. ${textedBack ? 'We texted them back.' : `Text-back not sent: ${result.error ?? result.status}.`}`;
  for (const owner of await ownerRecipients(db)) {
    if (!owner.phone) continue;
    await sendMessage({ channel: 'sms', to: owner.phone, body: alert, automationKey: 'missed_call_owner_alert' }).catch(() => undefined);
  }
  return { missed: true, textedBack, detail: textedBack ? result.status : result.error ?? result.status };
}
