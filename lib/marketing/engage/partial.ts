import 'server-only';
import { emit } from '@/lib/automations/engine';
import { captureConsent } from '@/lib/marketing/core/consent-capture';
import type { Db } from '@/lib/marketing/core/settings';
import { OTHER_PLATFORM, PLATFORMS, SERVICES } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { duePartialFollowUps } from './rules';

export const REMIND_CONSENT_VERSION = '2026-09-17-quote-reminder';
export const REMIND_CONSENT_TEXT = 'Email me one reminder if I don’t finish. No other marketing unless I opt in.';

const SESSION_KEY = /^[A-Za-z0-9_-]{16,64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_FOLLOW_UPS = 100;

export interface PartialInput {
  sessionKey: string;
  name: string;
  email: string;
  phone: string;
  platform: string | null;
  service: string | null;
  step: number;
  remind: boolean;
  pageUrl: string | null;
}

function formatPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return local.length === 10 ? `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}` : null;
}

/** Validates the step-1 payload. Honeypot hits return `spam` so the route can answer like a success. */
export function parsePartial(body: unknown): { ok: true; value: PartialInput } | { ok: false; spam?: boolean; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request.' };
  const v = body as Record<string, unknown>;
  const str = (key: string, max: number) => (typeof v[key] === 'string' ? (v[key] as string).trim().slice(0, max) : '');
  if (str('company', 100)) return { ok: false, spam: true, error: 'spam' };
  const sessionKey = str('sessionKey', 64);
  const name = str('name', 80);
  const email = str('email', 254).toLowerCase();
  const phone = formatPhone(str('phone', 30));
  if (!SESSION_KEY.test(sessionKey)) return { ok: false, error: 'Invalid session.' };
  if (name.length < 2 || !EMAIL.test(email) || !phone) return { ok: false, error: 'Name, phone and email are required.' };
  const platform = str('platform', 20);
  const service = str('service', 40);
  const step = Number(v.step);
  const pageUrl = str('pageUrl', 500);
  return {
    ok: true,
    value: {
      sessionKey, name, email, phone,
      platform: platform && (platform === OTHER_PLATFORM || PLATFORMS.some((p) => p.id === platform)) ? platform : null,
      service: service && SERVICES.some((s) => s.id === service) ? service : null,
      step: Number.isInteger(step) && step >= 1 && step <= 3 ? step : 1,
      remind: v.remind === true,
      pageUrl: /^https?:\/\//.test(pageUrl) ? pageUrl : null,
    },
  };
}

/** Upserts the in-progress form by browser session. Reminder consent goes through the consent ledger. */
export async function savePartial(input: PartialInput, meta: { ip: string | null; userAgent: string | null }, db: Db = createAdminClient()): Promise<{ ok: boolean }> {
  const { data: existing } = await db.from('partial_leads').select('id, converted_lead_id, remind_consent, customer_id').eq('session_key', input.sessionKey).maybeSingle();
  if (existing?.converted_lead_id) return { ok: true };

  let customerId = existing?.customer_id ?? null;
  const remind = input.remind || Boolean(existing?.remind_consent);
  if (input.remind && !existing?.remind_consent) {
    const consent = await captureConsent({
      channel: 'email', purpose: 'marketing', action: 'granted', email: input.email, fullName: input.name,
      consentTextVersion: REMIND_CONSENT_VERSION, consentText: REMIND_CONSENT_TEXT, sourceUrl: input.pageUrl ?? undefined,
    }, meta, db).catch(() => null);
    if (consent?.ok) customerId = consent.customerId;
  }

  const row = {
    session_key: input.sessionKey, full_name: input.name, email: input.email, phone: input.phone, platform: input.platform, service_id: input.service,
    step: input.step, remind_consent: remind, page_url: input.pageUrl, ip: meta.ip, customer_id: customerId, updated_at: new Date().toISOString(),
  };
  const { error } = await db.from('partial_leads').upsert(row, { onConflict: 'session_key' });
  if (error) console.error(`[engage] partial save failed: ${error.message}`);
  return { ok: !error };
}

export async function markPartialConverted(sessionKey: unknown, leadId: string, db: Db = createAdminClient()): Promise<void> {
  if (typeof sessionKey !== 'string' || !SESSION_KEY.test(sessionKey)) return;
  const { error } = await db.from('partial_leads').update({ converted_lead_id: leadId, updated_at: new Date().toISOString() }).eq('session_key', sessionKey);
  if (error) console.error(`[engage] partial convert failed: ${error.message}`);
}

/**
 * Cron step: one reminder per abandoned quote form, only for visitors who ticked
 * "remind me". Sent through the `mkt_abandoned_quote` automation (consent, caps, quiet hours apply).
 */
export async function runPartialFollowUps(now = new Date(), db: Db = createAdminClient()): Promise<{ due: number; emitted: number }> {
  const since = new Date(now.getTime() - 4 * 86_400_000).toISOString();
  const [{ data: partials, error }, { data: leads }] = await Promise.all([
    db.from('partial_leads').select('id, updated_at, remind_consent, converted_lead_id, followed_up_at, email, phone, customer_id, service_id')
      .is('converted_lead_id', null).is('followed_up_at', null).eq('remind_consent', true).gte('updated_at', since).limit(500),
    db.from('leads').select('email, phone, created_at').gte('created_at', since).limit(2000),
  ]);
  if (error) throw new Error(`partial leads unavailable: ${error.message}`);
  const due = duePartialFollowUps(
    (partials ?? []).map((p) => ({ ...p, updatedAt: p.updated_at, remindConsent: p.remind_consent, convertedLeadId: p.converted_lead_id, followedUpAt: p.followed_up_at })),
    (leads ?? []).map((l) => ({ email: l.email, phone: l.phone, createdAt: l.created_at })),
    now,
  ).slice(0, MAX_FOLLOW_UPS);

  let emitted = 0;
  for (const partial of due) {
    // Mark first so a failed send is never retried into a second reminder.
    await db.from('partial_leads').update({ followed_up_at: now.toISOString() }).eq('id', partial.id);
    if (!partial.customer_id) continue;
    const service = SERVICES.find((s) => s.id === partial.service_id)?.name.toLowerCase() ?? 'your truck';
    const { scheduled } = await emit({ name: 'marketing.abandoned_quote', subjectType: 'customer', subjectId: partial.customer_id, discriminator: partial.id, context: { due_service: service }, occurredAt: now });
    if (scheduled > 0) emitted += 1;
  }
  return { due: due.length, emitted };
}
