import 'server-only';
import { sendMessage } from '@/lib/messaging/send';
import { BUSINESS } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { findCustomerByAddress, recordConsent, suppressionFor } from './consent';
import { normalizeEmail, normalizePhone } from './policy';
import type { Db } from './settings';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const VERSION = /^[A-Za-z0-9._-]{1,40}$/;

export interface ConsentCaptureInput {
  channel: 'sms' | 'email';
  purpose: 'transactional' | 'marketing';
  action: 'granted' | 'revoked';
  phone?: string;
  email?: string;
  fullName?: string;
  consentTextVersion?: string;
  consentText?: string;
  sourceUrl?: string;
}

export type CaptureResult = { ok: true; customerId: string | null } | { ok: false; error: string; status: number };

export function parseConsentCapture(input: unknown): { ok: true; value: ConsentCaptureInput } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Invalid request.' };
  const v = input as Record<string, unknown>;
  const str = (key: string, max: number) => (typeof v[key] === 'string' ? (v[key] as string).trim().slice(0, max) : undefined);
  if (v.channel !== 'sms' && v.channel !== 'email') return { ok: false, error: 'channel must be sms or email.' };
  if (v.purpose !== 'transactional' && v.purpose !== 'marketing') return { ok: false, error: 'purpose must be transactional or marketing.' };
  if (v.action !== 'granted' && v.action !== 'revoked') return { ok: false, error: 'action must be granted or revoked.' };
  const value: ConsentCaptureInput = {
    channel: v.channel, purpose: v.purpose, action: v.action,
    phone: str('phone', 32), email: str('email', 254), fullName: str('fullName', 120),
    consentTextVersion: str('consentTextVersion', 40), consentText: str('consentText', 1000), sourceUrl: str('sourceUrl', 500),
  };
  if (value.channel === 'sms' && normalizePhone(value.phone ?? '').length < 11) return { ok: false, error: 'A valid mobile number is required.' };
  if (value.channel === 'email' && !EMAIL.test(value.email ?? '')) return { ok: false, error: 'A valid email is required.' };
  if (value.action === 'granted' && (!value.consentTextVersion || !VERSION.test(value.consentTextVersion))) {
    return { ok: false, error: 'consentTextVersion is required when granting consent.' };
  }
  return { ok: true, value };
}

/**
 * Records consent captured on a public form. Grants attach to an existing
 * customer, or create one when a name is given; evidence (IP, UA, URL, text
 * version) goes in the append-only ledger. Revocations never need a name.
 */
export async function captureConsent(input: ConsentCaptureInput, meta: { ip: string | null; userAgent: string | null }, db: Db = createAdminClient()): Promise<CaptureResult> {
  const address = input.channel === 'sms' ? normalizePhone(input.phone ?? '') : normalizeEmail(input.email ?? '');
  // A web form can't undo a STOP: carriers require the person to text START from that phone.
  if (input.action === 'granted' && input.channel === 'sms' && (await suppressionFor(db, 'sms', address))?.scope === 'all') {
    return { ok: false, error: 'This number opted out by text. Text START to us to resubscribe.', status: 409 };
  }
  let customerId = await findCustomerByAddress(db, input.channel, address);

  if (!customerId && input.action === 'granted') {
    if (!input.fullName) return { ok: false, error: 'Name is required for new contacts.', status: 422 };
    const { data, error } = await db.from('customers').insert({
      full_name: input.fullName, phone: input.phone ?? null, email: input.email ? normalizeEmail(input.email) : null,
      source: 'website', lifecycle_stage: 'subscriber', consent_source_url: input.sourceUrl ?? null,
    }).select('id').single();
    if (error || !data) return { ok: false, error: 'Could not save contact.', status: 500 };
    customerId = data.id;
  }
  if (customerId && input.sourceUrl && input.action === 'granted') {
    await db.from('customers').update({ consent_source_url: input.sourceUrl }).eq('id', customerId);
  }

  const result = await recordConsent(db, {
    customerId, channel: input.channel, purpose: input.purpose, action: input.action, method: 'form', address,
    consentTextVersion: input.consentTextVersion ?? null,
    evidence: { ip: meta.ip, userAgent: meta.userAgent, url: input.sourceUrl ?? null, text: input.consentText ?? null },
  });
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not record consent.', status: 500 };
  if (input.channel === 'sms' && input.purpose === 'marketing' && input.action === 'granted') {
    // CTIA opt-in confirmation: the real owner of the number learns about the signup and can reply STOP.
    await sendMessage({ channel: 'sms', to: address, customerId, automationKey: 'sms_marketing_opt_in_confirmation', purpose: 'transactional',
      body: `${BUSINESS.name}: you're signed up for promo texts (up to 2/week). Msg & data rates may apply. Reply HELP for help, STOP to cancel.` });
  }
  return { ok: true, customerId };
}
