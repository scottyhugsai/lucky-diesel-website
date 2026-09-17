import 'server-only';
import type { Enums } from '@/lib/db/database.types';
import { siteUrl } from '@/lib/site-url';
import { ensureMarketingSms, marketingEmailFooter } from './compliance';
import { suppressionFor } from './consent';
import {
  CAMPAIGN_KEY_PREFIX, MARKETING_AUTOMATION_PREFIX, isCapReached, isWithinWindow, nextSendTime, normalizeAddress, quietHoursWindow, weekAgo,
  type MessagePurpose,
} from './policy';
import { getMarketingSettings, type Db, type MarketingSettings } from './settings';
import { signToken } from './tokens';

type Channel = Enums<'message_channel'>;

export interface GateInput {
  channel: Channel;
  to: string;
  customerId: string | null | undefined;
  purpose: MessagePurpose;
  body: string;
  now?: Date;
}

export type GateResult =
  | { allowed: false; reason: string }
  | { allowed: true; body: string; headers: Record<string, string> };

export function unsubscribeUrl(channel: Channel, address: string, customerId: string | null | undefined): string {
  const token = signToken('unsubscribe', { c: channel, a: normalizeAddress(channel, address), ...(customerId ? { cid: customerId } : {}) });
  return `${siteUrl()}/api/marketing/unsubscribe?t=${encodeURIComponent(token)}`;
}

async function consentReason(db: Db, channel: Channel, customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return 'marketing needs a customer record with consent';
  const { data } = await db
    .from('customers')
    .select('sms_opted_out_at, sms_marketing_consent_at, sms_marketing_opted_out_at, email_marketing_status')
    .eq('id', customerId)
    .maybeSingle();
  if (!data) return 'customer not found';
  if (channel === 'sms') {
    if (data.sms_opted_out_at || data.sms_marketing_opted_out_at) return 'customer opted out of marketing texts';
    if (!data.sms_marketing_consent_at) return 'no marketing SMS consent on file';
    return null;
  }
  return data.email_marketing_status === 'subscribed' ? null : `email marketing ${data.email_marketing_status}`;
}

async function sentThisWeek(db: Db, channel: Channel, to: string, customerId: string | null | undefined, now: Date): Promise<number> {
  let query = db
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('channel', channel)
    .eq('direction', 'outbound')
    .in('status', ['sent', 'simulated'])
    .gte('created_at', weekAgo(now).toISOString())
    // Constant filter string, no user input.
    .or(`automation_key.like.${MARKETING_AUTOMATION_PREFIX}*,automation_key.like."${CAMPAIGN_KEY_PREFIX}*"`);
  query = customerId ? query.eq('customer_id', customerId) : query.eq('to_address', to);
  const { count, error } = await query;
  if (error) throw new Error(`frequency cap lookup failed: ${error.message}`);
  return count ?? 0;
}

function capFor(settings: MarketingSettings, channel: Channel): number {
  return channel === 'sms' ? settings.smsMaxPerWeek : settings.emailMaxPerWeek;
}

/**
 * The last gate before any provider call. Every purpose honours `scope = all`
 * suppressions (STOP, bounces, complaints). Marketing additionally needs
 * consent, no marketing suppression, quiet hours and the weekly cap, and gets
 * the business name / opt-out line (SMS) or CAN-SPAM footer and one-click
 * unsubscribe headers (email).
 */
export async function gateOutbound(db: Db, input: GateInput): Promise<GateResult> {
  const now = input.now ?? new Date();
  const suppression = await suppressionFor(db, input.channel, input.to);
  if (suppression?.scope === 'all') return { allowed: false, reason: `suppressed (${suppression.reason})` };
  if (input.purpose === 'transactional') return { allowed: true, body: input.body, headers: {} };

  if (suppression) return { allowed: false, reason: `suppressed from marketing (${suppression.reason})` };
  const consent = await consentReason(db, input.channel, input.customerId);
  if (consent) return { allowed: false, reason: consent };

  const settings = await getMarketingSettings(db);
  const window = quietHoursWindow(settings.quietHoursStart, settings.quietHoursEnd, settings.timeZone);
  if (!isWithinWindow(now, window)) {
    return { allowed: false, reason: `quiet hours (marketing resumes ${nextSendTime(now, window).toISOString()})` };
  }
  const cap = capFor(settings, input.channel);
  if (isCapReached(await sentThisWeek(db, input.channel, input.to, input.customerId, now), { maxPerWeek: cap })) {
    return { allowed: false, reason: `frequency cap (${cap} marketing ${input.channel === 'sms' ? 'texts' : 'emails'}/week)` };
  }

  if (input.channel === 'sms') return { allowed: true, body: ensureMarketingSms(input.body, settings.smsBusinessName), headers: {} };
  const url = unsubscribeUrl('email', input.to, input.customerId);
  const mailto = settings.replyToEmail ? `, <mailto:${settings.replyToEmail}?subject=unsubscribe>` : '';
  return {
    allowed: true,
    body: `${input.body}\n\n${marketingEmailFooter({ senderName: settings.senderName, postalAddress: settings.postalAddress, unsubscribeUrl: url })}`,
    headers: { 'List-Unsubscribe': `<${url}>${mailto}`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };
}
