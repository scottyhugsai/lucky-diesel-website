import 'server-only';
import type { Enums, Json, TablesUpdate } from '@/lib/db/database.types';
import { BUSINESS } from '@/lib/site';
import { classifyInboundSms, type InboundIntent } from './compliance';
import { normalizeAddress, normalizeEmail, phoneTail } from './policy';
import type { Db } from './settings';
import { verifyToken } from './tokens';

type Channel = Enums<'message_channel'>;
type Purpose = Enums<'mkt_consent_purpose'>;

export interface ConsentInput {
  customerId: string | null;
  channel: Channel;
  purpose: Purpose;
  action: Enums<'mkt_consent_action'>;
  /** form | keyword_stop | keyword_start | natural_language | unsubscribe_link | owner | import | bounce | complaint */
  method: string;
  address: string;
  consentTextVersion?: string | null;
  evidence?: { ip?: string | null; userAgent?: string | null; url?: string | null; text?: string | null; [key: string]: Json | undefined };
}

/** Finds a customer by phone (loose formatting) or email. */
export async function findCustomerByAddress(db: Db, channel: Channel, address: string): Promise<string | null> {
  if (channel === 'email') {
    const { data } = await db.from('customers').select('id').eq('email', normalizeEmail(address)).limit(1);
    return data?.[0]?.id ?? null;
  }
  const tail = phoneTail(address);
  if (tail.length < 10) return null;
  // Digits only, so safe in a LIKE pattern; exact match is confirmed in code.
  const { data } = await db.from('customers').select('id, phone').ilike('phone', `%${tail.slice(-4)}%`).limit(50);
  return data?.find((c) => c.phone && phoneTail(c.phone) === tail)?.id ?? null;
}

export async function suppress(db: Db, channel: Channel, address: string, scope: 'all' | 'marketing', reason: string, customerId: string | null): Promise<void> {
  const normalized = normalizeAddress(channel, address);
  if (!normalized) return;
  const { error } = await db.from('suppressions').upsert(
    { channel, address: normalized, scope, reason, customer_id: customerId },
    { onConflict: 'channel,address,scope', ignoreDuplicates: true },
  );
  if (error) console.error(`[marketing] suppression failed: ${error.message}`);
}

export async function unsuppress(db: Db, channel: Channel, address: string, scopes: ('all' | 'marketing')[]): Promise<void> {
  const { error } = await db.from('suppressions').delete().eq('channel', channel).eq('address', normalizeAddress(channel, address)).in('scope', scopes);
  if (error) console.error(`[marketing] unsuppress failed: ${error.message}`);
}

/** The strictest active suppression for an address, or null. */
export async function suppressionFor(db: Db, channel: Channel, address: string): Promise<{ scope: string; reason: string } | null> {
  const normalized = normalizeAddress(channel, address);
  if (!normalized) return null;
  const { data } = await db.from('suppressions').select('scope, reason').eq('channel', channel).eq('address', normalized);
  if (!data?.length) return null;
  return data.find((s) => s.scope === 'all') ?? data[0]!;
}

function customerPatch(input: ConsentInput, at: string): TablesUpdate<'customers'> | null {
  const granted = input.action === 'granted';
  if (input.channel === 'email') {
    return input.purpose === 'marketing' || !granted ? { email_marketing_status: granted ? 'subscribed' : 'unsubscribed' } : null;
  }
  if (input.purpose === 'marketing') {
    return granted
      ? { sms_marketing_consent_at: at, sms_marketing_consent_version: input.consentTextVersion ?? null, sms_marketing_opted_out_at: null }
      : { sms_marketing_opted_out_at: at };
  }
  return granted ? { sms_consent: true, sms_consent_at: at, sms_opted_out_at: null } : { sms_consent: false, sms_opted_out_at: at, sms_marketing_opted_out_at: at };
}

/**
 * Appends to the consent ledger, then mirrors the state onto the customer and
 * the suppression list. Revoking transactional SMS (STOP) revokes marketing too.
 */
export async function recordConsent(db: Db, input: ConsentInput): Promise<{ ok: boolean; error?: string }> {
  const address = normalizeAddress(input.channel, input.address);
  if (!address) return { ok: false, error: 'A valid phone or email is required.' };
  const at = new Date().toISOString();
  const { error } = await db.from('contact_consent_events').insert({
    customer_id: input.customerId,
    channel: input.channel,
    purpose: input.purpose,
    action: input.action,
    method: input.method.slice(0, 40),
    address,
    consent_text_version: input.consentTextVersion ?? null,
    evidence: (input.evidence ?? {}) as Json,
  });
  if (error) {
    console.error(`[marketing] consent ledger insert failed: ${error.message}`);
    return { ok: false, error: 'Could not record consent.' };
  }

  const patch = customerPatch(input, at);
  if (input.customerId && patch) {
    const { error: updateError } = await db.from('customers').update(patch).eq('id', input.customerId);
    if (updateError) console.error(`[marketing] consent customer update failed: ${updateError.message}`);
  }

  const scope = input.purpose === 'marketing' ? 'marketing' : 'all';
  if (input.action === 'revoked') {
    await suppress(db, input.channel, address, scope, input.method, input.customerId);
  } else {
    await unsuppress(db, input.channel, address, input.purpose === 'marketing' ? ['marketing'] : ['all']);
  }
  return { ok: true };
}

export interface InboundResult {
  intent: InboundIntent;
  customerId: string | null;
  /** Reply to send back as TwiML, if any. */
  reply: string | null;
}

/** STOP / START / HELP (plus natural-language opt-outs) for an inbound text. Logs the message. */
export async function handleInboundSms(db: Db, input: { from: string; body: string; messageSid: string | null }): Promise<InboundResult> {
  const intent = classifyInboundSms(input.body);
  const customerId = await findCustomerByAddress(db, 'sms', input.from);
  const evidence = { text: input.body.slice(0, 500), messageSid: input.messageSid };

  const { error } = await db.from('messages').insert({
    customer_id: customerId, channel: 'sms', direction: 'inbound', to_address: input.from, body: input.body.slice(0, 1600),
    status: 'sent', provider_id: input.messageSid, automation_key: intent === 'other' ? null : `inbound:${intent}`,
  });
  if (error) console.error(`[marketing] could not log inbound SMS: ${error.message}`);

  if (intent === 'stop') {
    const method = /^\s*[a-z ]+\s*$/i.test(input.body) && input.body.trim().split(/\s+/).length <= 2 ? 'keyword_stop' : 'natural_language';
    await recordConsent(db, { customerId, channel: 'sms', purpose: 'transactional', action: 'revoked', method, address: input.from, evidence });
    return { intent, customerId, reply: `${BUSINESS.name}: you're unsubscribed and won't get more texts. Reply START to resubscribe.` };
  }
  if (intent === 'start') {
    await recordConsent(db, { customerId, channel: 'sms', purpose: 'transactional', action: 'granted', method: 'keyword_start', address: input.from, evidence });
    return { intent, customerId, reply: `${BUSINESS.name}: you're resubscribed to service texts. Reply STOP to opt out, HELP for help.` };
  }
  if (intent === 'help') {
    return { intent, customerId, reply: `${BUSINESS.name}: service and appointment texts. Call ${BUSINESS.phoneDisplay} or email ${BUSINESS.email}. Msg & data rates may apply. Reply STOP to opt out.` };
  }
  return { intent, customerId, reply: null };
}

/** One-click / link unsubscribe from marketing email or SMS. */
export async function unsubscribeWithToken(db: Db, token: string | null, meta: { ip: string | null; userAgent: string | null }): Promise<{ ok: boolean; address?: string }> {
  const payload = verifyToken('unsubscribe', token);
  const channel = payload?.c === 'sms' ? 'sms' : payload?.c === 'email' ? 'email' : null;
  if (!payload || !channel || !payload.a) return { ok: false };
  const customerId = payload.cid && /^[0-9a-f-]{36}$/i.test(payload.cid) ? payload.cid : await findCustomerByAddress(db, channel, payload.a);
  const result = await recordConsent(db, {
    customerId, channel, purpose: 'marketing', action: 'revoked', method: 'unsubscribe_link', address: payload.a,
    evidence: { ip: meta.ip, userAgent: meta.userAgent },
  });
  return { ok: result.ok, address: payload.a };
}
