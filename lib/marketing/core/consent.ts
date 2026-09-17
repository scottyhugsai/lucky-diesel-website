import 'server-only';
import type { Enums, Json, TablesUpdate } from '@/lib/db/database.types';
import { SMS_CONSENT_VERSION } from '@/lib/lead';
import { BUSINESS } from '@/lib/site';
import { classifyInboundSms, type InboundIntent } from './compliance';
import { normalizeAddress, normalizeEmail, phoneTail } from './policy';
import type { Db } from './settings';
import { verifyToken } from './tokens';
import { ensureOptInReply, matchKeyword } from './topics';
import { SOLD_TAG, isTruckSoldMessage } from './truck-sold';

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

/** Settings flag: one opt-out revokes every purpose on that address (FCC revoke-all, C4). */
export async function revokeAllEnabled(db: Db): Promise<boolean> {
  const { data, error } = await db.from('marketing_settings').select('revoke_all_on_opt_out').eq('id', 1).maybeSingle();
  if (error) console.error(`[marketing] revoke-all flag unavailable: ${error.message}`);
  return Boolean(data?.revoke_all_on_opt_out);
}

/**
 * Appends to the consent ledger, then mirrors the state onto the customer and
 * the suppression list. Revoking transactional SMS (STOP) revokes marketing too.
 * With revoke-all on, a marketing opt-out is widened to every purpose.
 */
export async function recordConsent(db: Db, requested: ConsentInput): Promise<{ ok: boolean; error?: string }> {
  const address = normalizeAddress(requested.channel, requested.address);
  if (!address) return { ok: false, error: 'A valid phone or email is required.' };
  const widen = requested.action === 'revoked' && requested.purpose === 'marketing' && (await revokeAllEnabled(db));
  const input: ConsentInput = widen
    ? { ...requested, purpose: 'transactional', evidence: { ...requested.evidence, revoke_all: true, requested_purpose: 'marketing' } }
    : requested;
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

/**
 * Owner-defined keywords: `opt_in` grants marketing SMS consent (CTIA
 * confirmation added), `reply` just answers (HOURS, BOOK, PRICE). Carrier
 * keywords are handled earlier and can't be defined here.
 */
async function handleKeyword(
  db: Db,
  input: { from: string; body: string; customerId: string | null; evidence: Record<string, string | null> },
): Promise<string | null> {
  const { data } = await db.from('sms_keywords').select('id, keyword, action, reply, active, hits').eq('active', true);
  const hit = matchKeyword(input.body, data ?? []);
  if (!hit) return null;
  await db.from('sms_keywords').update({ hits: hit.hits + 1, last_hit_at: new Date().toISOString() }).eq('id', hit.id);
  if (hit.action !== 'opt_in') return hit.reply;
  await recordConsent(db, {
    customerId: input.customerId, channel: 'sms', purpose: 'marketing', action: 'granted', method: 'keyword',
    address: input.from, consentTextVersion: SMS_CONSENT_VERSION, evidence: { ...input.evidence, keyword: hit.keyword },
  });
  return ensureOptInReply(hit.reply, BUSINESS.name);
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
  if (intent === 'other') {
    const keywordReply = await handleKeyword(db, { from: input.from, body: input.body, customerId, evidence });
    if (keywordReply) return { intent, customerId, reply: keywordReply };
  }
  if (customerId && isTruckSoldMessage(input.body)) {
    // Flag for the owner; sold trucks are marked by hand so a stray "sold" never drops a truck.
    const { data: customer } = await db.from('customers').select('tags').eq('id', customerId).maybeSingle();
    if (customer && !customer.tags.includes(SOLD_TAG)) await db.from('customers').update({ tags: [...customer.tags, SOLD_TAG] }).eq('id', customerId);
    return { intent, customerId, reply: `${BUSINESS.name}: thanks for letting us know. Got a new truck? Reply with the year, make and model.` };
  }
  if (intent === 'help') {
    return { intent, customerId, reply: `${BUSINESS.name}: service and appointment texts. Call ${BUSINESS.phoneDisplay} or email ${BUSINESS.email}. Msg & data rates may apply. Reply STOP to opt out.` };
  }
  return { intent, customerId, reply: null };
}

export interface PreferenceState {
  address: string;
  customerId: string | null;
  /** Topic keys the customer has switched off. */
  topicsOff: string[];
  subscribed: boolean;
}

/** Reads the preference centre state for a signed unsubscribe/preferences token. */
export async function preferencesForToken(db: Db, token: string | null): Promise<PreferenceState | null> {
  const payload = verifyToken('unsubscribe', token);
  if (!payload?.a || payload.c !== 'email') return null;
  const address = normalizeEmail(payload.a);
  if (!address) return null;
  const customerId = payload.cid && /^[0-9a-f-]{36}$/i.test(payload.cid) ? payload.cid : await findCustomerByAddress(db, 'email', address);
  if (!customerId) return { address, customerId: null, topicsOff: [], subscribed: true };
  const { data } = await db.from('customers').select('email_topics_off, email_marketing_status').eq('id', customerId).maybeSingle();
  return { address, customerId, topicsOff: data?.email_topics_off ?? [], subscribed: (data?.email_marketing_status ?? 'subscribed') === 'subscribed' };
}

/**
 * Saves topic choices. Turning every topic off is a full unsubscribe, so it goes
 * through the consent ledger; keeping at least one resubscribes the address.
 */
export async function saveEmailPreferences(
  db: Db,
  input: { token: string | null; topicsOff: string[]; allTopics: readonly string[]; meta: { ip: string | null; userAgent: string | null } },
): Promise<{ ok: boolean; unsubscribed: boolean }> {
  const state = await preferencesForToken(db, input.token);
  if (!state) return { ok: false, unsubscribed: false };
  const topicsOff = [...new Set(input.topicsOff.filter((t) => input.allTopics.includes(t)))];
  const unsubscribed = topicsOff.length >= input.allTopics.length;
  if (state.customerId) {
    const { error } = await db.from('customers').update({ email_topics_off: topicsOff }).eq('id', state.customerId);
    if (error) console.error(`[marketing] preference save failed: ${error.message}`);
  }
  const evidence = { ip: input.meta.ip, userAgent: input.meta.userAgent, topics_off: topicsOff.join(',') };
  if (unsubscribed) {
    const result = await recordConsent(db, { customerId: state.customerId, channel: 'email', purpose: 'marketing', action: 'revoked', method: 'preference_center', address: state.address, evidence });
    return { ok: result.ok, unsubscribed: true };
  }
  // Re-subscribing from the link is fine, but a spam complaint or bounce stays put.
  const suppression = await suppressionFor(db, 'email', state.address);
  if (!state.subscribed && (!suppression || suppression.reason === 'preference_center' || suppression.reason === 'unsubscribe_link')) {
    const result = await recordConsent(db, { customerId: state.customerId, channel: 'email', purpose: 'marketing', action: 'granted', method: 'preference_center', address: state.address, evidence });
    return { ok: result.ok, unsubscribed: false };
  }
  return { ok: true, unsubscribed: false };
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
