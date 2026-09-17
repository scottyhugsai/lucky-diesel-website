import 'server-only';
import type { Enums } from '@/lib/db/database.types';
import { siteUrl } from '@/lib/site-url';
import { ensureMarketingSms, marketingEmailFooter } from './compliance';
import { suppressionFor } from './consent';
import { formatSender } from './deliverability';
import { withHtmlFooter } from './email-blocks';
import {
  CAMPAIGN_KEY_PREFIX, MARKETING_AUTOMATION_PREFIX, dayAgo, isCapReached, isDailyCapReached, isWithinAll, nextSendTimeAll, normalizeAddress,
  quietHoursWindow, recipientRules, recipientWindows, weekAgo, type MessagePurpose, type SendWindow,
} from './policy';
import { getMarketingSettings, type Db, type MarketingSettings } from './settings';
import { signToken } from './tokens';
import { isTopicAllowed } from './topics';

type Channel = Enums<'message_channel'>;

export interface GateInput {
  channel: Channel;
  to: string;
  customerId: string | null | undefined;
  purpose: MessagePurpose;
  body: string;
  /** Optional HTML part (email); gets the compliance footer too. */
  html?: string | null;
  /** Email topic, checked against the customer's preferences. */
  topic?: string | null;
  /** Per-campaign display name; the address stays the verified sender. */
  fromName?: string | null;
  now?: Date;
}

export type GateResult =
  | { allowed: false; reason: string }
  | { allowed: true; body: string; html?: string; headers: Record<string, string>; from?: string; replyTo?: string };

function unsubscribeToken(channel: Channel, address: string, customerId: string | null | undefined): string {
  return signToken('unsubscribe', { c: channel, a: normalizeAddress(channel, address), ...(customerId ? { cid: customerId } : {}) });
}

export function unsubscribeUrl(channel: Channel, address: string, customerId: string | null | undefined): string {
  return `${siteUrl()}/api/marketing/unsubscribe?t=${encodeURIComponent(unsubscribeToken(channel, address, customerId))}`;
}

/** Public preference center. Same token as unsubscribe: whoever can opt out can pick topics. */
export function preferencesUrl(address: string, customerId: string | null | undefined): string {
  return `${siteUrl()}/preferences?t=${encodeURIComponent(unsubscribeToken('email', address, customerId))}`;
}

/**
 * Allowed windows for a marketing send. Texts use the recipient's area-code
 * time zone(s) and the 8pm cap in FL/OK/MD; email uses the shop time zone.
 */
export function marketingWindows(settings: MarketingSettings, channel: Channel, to: string, base?: { startHour: number; endHour: number }): SendWindow[] {
  const legal = quietHoursWindow(settings.quietHoursStart, settings.quietHoursEnd, settings.timeZone);
  const hours = base ? { startHour: Math.max(base.startHour, legal.startHour), endHour: Math.min(base.endHour, legal.endHour) } : legal;
  if (channel !== 'sms' || !settings.recipientLocalTime) return [{ ...hours, timeZone: settings.timeZone }];
  return recipientWindows(hours, recipientRules(to, settings.timeZone));
}

async function consentReason(db: Db, channel: Channel, customerId: string | null | undefined, topic: string | null | undefined): Promise<string | null> {
  if (!customerId) return 'marketing needs a customer record with consent';
  const { data } = await db
    .from('customers')
    .select('sms_opted_out_at, sms_marketing_consent_at, sms_marketing_opted_out_at, email_marketing_status, email_topics_off')
    .eq('id', customerId)
    .maybeSingle();
  if (!data) return 'customer not found';
  if (channel === 'sms') {
    if (data.sms_opted_out_at || data.sms_marketing_opted_out_at) return 'customer opted out of marketing texts';
    if (!data.sms_marketing_consent_at) return 'no marketing SMS consent on file';
    return null;
  }
  if (data.email_marketing_status !== 'subscribed') return `email marketing ${data.email_marketing_status}`;
  return isTopicAllowed(data.email_topics_off, topic) ? null : `opted out of ${topic} emails`;
}

async function sentSince(db: Db, channel: Channel, to: string, customerId: string | null | undefined, since: Date): Promise<number> {
  let query = db
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('channel', channel)
    .eq('direction', 'outbound')
    .in('status', ['sent', 'simulated'])
    .gte('created_at', since.toISOString())
    // Constant filter string, no user input.
    .or(`automation_key.like.${MARKETING_AUTOMATION_PREFIX}*,automation_key.like."${CAMPAIGN_KEY_PREFIX}*"`);
  query = customerId ? query.eq('customer_id', customerId) : query.eq('to_address', to);
  const { count, error } = await query;
  if (error) throw new Error(`frequency cap lookup failed: ${error.message}`);
  return count ?? 0;
}

function capFor(settings: MarketingSettings, channel: Channel): { week: number; day: number } {
  return channel === 'sms' ? { week: settings.smsMaxPerWeek, day: settings.smsMaxPerDay } : { week: settings.emailMaxPerWeek, day: settings.emailMaxPerDay };
}

/**
 * The last gate before any provider call. Every purpose honours `scope = all`
 * suppressions (STOP, bounces, complaints). Marketing additionally needs
 * consent (and topic preference), no marketing suppression, recipient-local
 * quiet hours, daily and weekly caps, and gets the business name / opt-out line
 * (SMS) or CAN-SPAM footer, stored sender and one-click unsubscribe (email).
 */
export async function gateOutbound(db: Db, input: GateInput): Promise<GateResult> {
  const now = input.now ?? new Date();
  const suppression = await suppressionFor(db, input.channel, input.to);
  if (suppression?.scope === 'all') return { allowed: false, reason: `suppressed (${suppression.reason})` };
  if (input.purpose === 'transactional') return { allowed: true, body: input.body, ...(input.html ? { html: input.html } : {}), headers: {} };

  if (suppression) return { allowed: false, reason: `suppressed from marketing (${suppression.reason})` };
  const consent = await consentReason(db, input.channel, input.customerId, input.topic);
  if (consent) return { allowed: false, reason: consent };

  const settings = await getMarketingSettings(db);
  const windows = marketingWindows(settings, input.channel, input.to);
  if (!isWithinAll(now, windows)) {
    return { allowed: false, reason: `quiet hours for the recipient (marketing resumes ${nextSendTimeAll(now, windows).toISOString()})` };
  }
  const cap = capFor(settings, input.channel);
  const noun = input.channel === 'sms' ? 'texts' : 'emails';
  if (cap.day > 0 && isDailyCapReached(await sentSince(db, input.channel, input.to, input.customerId, dayAgo(now)), cap.day)) {
    return { allowed: false, reason: `daily cap (${cap.day} marketing ${noun}/day)` };
  }
  if (isCapReached(await sentSince(db, input.channel, input.to, input.customerId, weekAgo(now)), { maxPerWeek: cap.week })) {
    return { allowed: false, reason: `frequency cap (${cap.week} marketing ${noun}/week)` };
  }

  if (input.channel === 'sms') return { allowed: true, body: ensureMarketingSms(input.body, settings.smsBusinessName), headers: {} };
  const url = unsubscribeUrl('email', input.to, input.customerId);
  const mailto = settings.replyToEmail ? `, <mailto:${settings.replyToEmail}?subject=unsubscribe>` : '';
  const footer = marketingEmailFooter({ senderName: settings.senderName, postalAddress: settings.postalAddress, unsubscribeUrl: url, preferencesUrl: preferencesUrl(input.to, input.customerId) });
  const fallbackFrom = process.env.LEAD_FROM_EMAIL?.trim() || 'Lucky Diesel <onboarding@resend.dev>';
  return {
    allowed: true,
    body: `${input.body}\n\n${footer}`,
    ...(input.html ? { html: withHtmlFooter(input.html, footer) } : {}),
    headers: { 'List-Unsubscribe': `<${url}>${mailto}`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    from: formatSender(input.fromName?.trim() || settings.senderName, settings.senderEmail, fallbackFrom),
    ...(settings.replyToEmail ? { replyTo: settings.replyToEmail } : {}),
  };
}
