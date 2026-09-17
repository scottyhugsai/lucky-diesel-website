import 'server-only';
import type { Enums } from '@/lib/db/database.types';
import { gateOutbound } from '@/lib/marketing/core/gate';
import { isMarketingAutomationKey, type MessagePurpose } from '@/lib/marketing/core/policy';
import { createAdminClient } from '@/lib/supabase/admin';

export interface OutboundMessage {
  channel: Enums<'message_channel'>;
  to: string;
  subject?: string;
  body: string;
  customerId?: string | null;
  workOrderId?: string | null;
  automationKey?: string | null;
  /** Customer texts need recorded consent; owner/staff alerts don't. */
  requiresSmsConsent?: boolean;
  /**
   * `marketing` adds consent, suppression, weekly caps, quiet hours, the business
   * name / STOP line and List-Unsubscribe. Defaults to `transactional`, except
   * automation keys starting `mkt_` or `campaign:`, which are always marketing.
   */
  purpose?: MessagePurpose;
}

export interface SendResult {
  status: Enums<'message_status'>;
  messageId: string | null;
  error?: string;
}

const RESEND_TIMEOUT_MS = 8000;

async function sendEmail(to: string, subject: string, body: string, headers: Record<string, string> = {}): Promise<{ id: string | null; error?: string; deliveredTo: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { id: null, error: 'RESEND_API_KEY not set', deliveredTo: to };

  // Demo mode: every email lands in the presenter's inbox, addressed as if to the customer.
  const override = process.env.DEMO_EMAIL_TO?.trim();
  const deliveredTo = override || to;
  const from = process.env.LEAD_FROM_EMAIL?.trim() || 'Lucky Diesel <onboarding@resend.dev>';
  const text = override && override !== to ? `[Demo — intended for ${to}]\n\n${body}` : body;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [deliveredTo], subject, text, ...(Object.keys(headers).length ? { headers } : {}) }),
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
  });
  if (!response.ok) return { id: null, error: `Resend ${response.status}: ${await response.text().catch(() => '')}`, deliveredTo };
  const data = (await response.json().catch(() => ({}))) as { id?: string };
  return { id: data.id ?? null, deliveredTo };
}

async function sendSms(to: string, body: string): Promise<{ id: string | null; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || !service) return { id: null, error: 'Twilio messaging service not configured' };

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: toE164(to), MessagingServiceSid: service, Body: body }),
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
  });
  const data = (await response.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!response.ok) return { id: null, error: `Twilio ${response.status}: ${data.message ?? ''}` };
  return { id: data.sid ?? null };
}

export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

async function smsBlockedReason(customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return 'no customer on file';
  const { data } = await createAdminClient()
    .from('customers')
    .select('sms_consent, sms_opted_out_at')
    .eq('id', customerId)
    .maybeSingle();
  if (!data) return 'customer not found';
  if (data.sms_opted_out_at) return 'customer replied STOP';
  if (!data.sms_consent) return 'no SMS consent on file';
  return null;
}

/**
 * Sends (or simulates) one message and records it in `messages`.
 * Never throws for delivery problems — the result and the log say what happened.
 */
export async function sendMessage(message: OutboundMessage): Promise<SendResult> {
  const db = createAdminClient();
  let status: Enums<'message_status'>;
  let providerId: string | null = null;
  let error: string | undefined;
  let body = message.body;
  const purpose: MessagePurpose = isMarketingAutomationKey(message.automationKey) ? 'marketing' : (message.purpose ?? 'transactional');

  try {
    const gate = await gateOutbound(db, { channel: message.channel, to: message.to, customerId: message.customerId, purpose, body });
    if (!gate.allowed) {
      status = 'skipped';
      error = gate.reason;
    } else if (message.channel === 'sms') {
      body = gate.body;
      const blocked = message.requiresSmsConsent ? await smsBlockedReason(message.customerId) : null;
      if (blocked) {
        status = 'skipped';
        error = blocked;
      } else if (process.env.MESSAGING_SMS_MODE === 'live') {
        const result = await sendSms(message.to, body);
        status = result.error ? 'failed' : 'sent';
        providerId = result.id;
        error = result.error;
      } else {
        status = 'simulated';
      }
    } else {
      body = gate.body;
      const result = await sendEmail(message.to, message.subject ?? 'Lucky Diesel', body, gate.headers);
      status = result.error ? 'failed' : 'sent';
      providerId = result.id;
      error = result.error;
    }
  } catch (caught) {
    status = 'failed';
    error = caught instanceof Error ? caught.message : String(caught);
  }

  if (status === 'failed') console.error(`[messaging] ${message.channel} to ${message.to} failed: ${error}`);

  const { data, error: insertError } = await db
    .from('messages')
    .insert({
      channel: message.channel,
      to_address: message.to,
      subject: message.subject ?? null,
      body,
      status,
      provider_id: providerId,
      error: error ?? null,
      customer_id: message.customerId ?? null,
      work_order_id: message.workOrderId ?? null,
      automation_key: message.automationKey ?? null,
    })
    .select('id')
    .single();
  if (insertError) console.error(`[messaging] could not log message: ${insertError.message}`);

  return { status, messageId: data?.id ?? null, error };
}
