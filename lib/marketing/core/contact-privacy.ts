import 'server-only';
import { createHash } from 'node:crypto';
import { normalizeEmail, normalizePhone } from './policy';
import type { Db } from './settings';

/**
 * Per-person data requests: a full JSON export, a consent-proof packet, and
 * anonymization. Callers must already have checked requireRole('admin').
 */

const LIMIT = 2000;
export const ERASED = '[erased]';

/** Stable one-way id for an address, so a redacted ledger row can still be matched on request. */
export function hashAddress(address: string): string {
  return `sha256:${createHash('sha256').update(address.trim().toLowerCase()).digest('hex')}`;
}

/** Addresses the consent ledger may hold for this person, normalised like the ledger stores them. */
export function contactAddresses(customer: { email: string | null; phone: string | null }): string[] {
  return [customer.email ? normalizeEmail(customer.email) : '', customer.phone ? normalizePhone(customer.phone) : ''].filter(Boolean);
}

/** Every ledger row tied to the customer id or to their current phone/email. */
export async function loadConsentProof(db: Db, customerId: string) {
  const { data: customer } = await db.from('customers').select('id, full_name, email, phone').eq('id', customerId).maybeSingle();
  if (!customer) return null;
  const addresses = contactAddresses(customer);
  const [byId, byAddress] = await Promise.all([
    db.from('contact_consent_events').select('*').eq('customer_id', customerId).order('created_at').limit(LIMIT),
    addresses.length ? db.from('contact_consent_events').select('*').in('address', addresses).order('created_at').limit(LIMIT) : Promise.resolve({ data: [] as never[], error: null }),
  ]);
  if (byId.error || byAddress.error) throw new Error('consent proof query failed');
  const seen = new Set<string>();
  const events = [...(byId.data ?? []), ...(byAddress.data ?? [])]
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const { data: suppressions } = addresses.length
    ? await db.from('suppressions').select('channel, address, scope, reason, created_at').in('address', addresses)
    : { data: [] };
  return { customer, addresses, events, suppressions: suppressions ?? [] };
}

/** Everything stored about one person, for a data-access request. */
export async function buildContactExport(db: Db, customerId: string): Promise<Record<string, unknown> | null> {
  const { data: customer } = await db.from('customers').select('*').eq('id', customerId).maybeSingle();
  if (!customer) return null;
  const { data: vehicles } = await db.from('vehicles').select('*').eq('customer_id', customerId).limit(LIMIT);
  const vehicleIds = (vehicles ?? []).map((v) => v.id);
  const [leads, appointments, workOrders, invoices, messages, touches, conversions, sends, enrollments, referralCodes, loyalty, loyaltyEvents, registrations, tunes, builds, proof] = await Promise.all([
    db.from('leads').select('*').eq('customer_id', customerId).limit(LIMIT),
    db.from('appointments').select('*').eq('customer_id', customerId).limit(LIMIT),
    db.from('work_orders').select('id, number, title, status, mileage_in, created_at, completed_at').eq('customer_id', customerId).limit(LIMIT),
    db.from('invoices').select('id, number, status, total_cents, paid_at, created_at').eq('customer_id', customerId).limit(LIMIT),
    db.from('messages').select('channel, direction, to_address, subject, body, status, created_at').eq('customer_id', customerId).order('created_at').limit(LIMIT),
    db.from('attribution_touches').select('touch_type, source, medium, campaign, landing_path, referrer, occurred_at').eq('customer_id', customerId).limit(LIMIT),
    db.from('conversion_events').select('kind, source, value_cents, occurred_at').eq('customer_id', customerId).limit(LIMIT),
    db.from('campaign_sends').select('channel, status, scheduled_for, sent_at, clicked_at, converted_at, campaigns(name)').eq('customer_id', customerId).limit(LIMIT),
    db.from('campaign_enrollments').select('status, enrolled_at, exited_at, campaigns(name)').eq('customer_id', customerId).limit(LIMIT),
    db.from('referral_codes').select('code, uses, created_at').eq('customer_id', customerId).limit(LIMIT),
    db.from('loyalty_accounts').select('*').eq('customer_id', customerId).limit(1),
    db.from('loyalty_events').select('*').eq('customer_id', customerId).limit(LIMIT),
    db.from('event_registrations').select('*').eq('customer_id', customerId).limit(LIMIT),
    vehicleIds.length ? db.from('tune_records').select('*').in('vehicle_id', vehicleIds).limit(LIMIT) : Promise.resolve({ data: [] }),
    vehicleIds.length ? db.from('build_items').select('*').in('vehicle_id', vehicleIds).limit(LIMIT) : Promise.resolve({ data: [] }),
    loadConsentProof(db, customerId),
  ]);
  return {
    exported_at: new Date().toISOString(),
    customer,
    vehicles: vehicles ?? [],
    tune_records: tunes.data ?? [],
    build_items: builds.data ?? [],
    leads: leads.data ?? [],
    appointments: appointments.data ?? [],
    work_orders: workOrders.data ?? [],
    invoices: invoices.data ?? [],
    messages: messages.data ?? [],
    website_visits: touches.data ?? [],
    conversions: conversions.data ?? [],
    campaign_sends: sends.data ?? [],
    campaign_enrollments: enrollments.data ?? [],
    referral_codes: referralCodes.data ?? [],
    loyalty_account: loyalty.data?.[0] ?? null,
    loyalty_events: loyaltyEvents.data ?? [],
    event_registrations: registrations.data ?? [],
    consent_events: proof?.events ?? [],
    suppressions: proof?.suppressions ?? [],
  };
}

export type AnonymizeResult = { ok: true } | { ok: false; error: string };

/**
 * Honors a deletion request. Names, addresses, notes and message bodies are
 * wiped; money records (jobs, invoices) stay for tax and warranty law. The
 * consent ledger is kept as proof, with addresses replaced by a hash and
 * evidence (IP, user agent, text) removed. Existing suppressions stay so the
 * person is never contacted again.
 */
export async function anonymizeContact(db: Db, customerId: string, actorId: string | null): Promise<AnonymizeResult> {
  const { data: customer } = await db.from('customers').select('id, email, phone, profile_id, anonymized_at').eq('id', customerId).maybeSingle();
  if (!customer) return { ok: false, error: 'Contact not found.' };
  if (customer.anonymized_at) return { ok: false, error: 'Already erased.' };
  if (customer.profile_id) return { ok: false, error: 'They have a portal login. Remove it first.' };

  const now = new Date().toISOString();
  const { data: ledger, error: ledgerError } = await db.from('contact_consent_events').select('id, address').eq('customer_id', customerId).limit(LIMIT);
  if (ledgerError) return { ok: false, error: 'Could not read the consent ledger.' };
  for (const row of ledger ?? []) {
    if (row.address.startsWith('sha256:')) continue;
    const { error } = await db.from('contact_consent_events').update({ address: hashAddress(row.address), evidence: { redacted_at: now } }).eq('id', row.id);
    if (error) return { ok: false, error: 'Could not redact the consent ledger.' };
  }

  const { error: customerError } = await db.from('customers').update({
    full_name: 'Erased contact', email: null, phone: null, notes: null, tags: [], birthday: null, consent_source_url: null,
    sms_consent: false, sms_consent_at: null, sms_marketing_consent_at: null, sms_marketing_consent_version: null,
    email_marketing_status: 'unsubscribed', anonymized_at: now,
  }).eq('id', customerId);
  if (customerError) return { ok: false, error: 'Could not erase the contact.' };

  // Best effort from here: the person is already unreachable and out of every segment query.
  const steps = await Promise.all([
    db.from('vehicles').update({ vin: null, nickname: null, photo_path: null }).eq('customer_id', customerId),
    db.from('leads').update({ full_name: 'Erased contact', email: ERASED, phone: ERASED, details: null, consent_ip: null }).eq('customer_id', customerId),
    db.from('messages').update({ to_address: ERASED, body: ERASED, subject: null }).eq('customer_id', customerId),
    db.from('event_registrations').update({ full_name: 'Erased contact', email: null, phone: null }).eq('customer_id', customerId),
    db.from('tracking_visitors').update({ user_agent: null, ga_client_id: null, fbp: null, fbc: null }).eq('customer_id', customerId),
    db.from('campaign_sends').update({ status: 'cancelled', detail: 'contact erased' }).eq('customer_id', customerId).eq('status', 'scheduled'),
    db.from('campaign_enrollments').update({ status: 'exited', exited_at: now, exit_reason: 'erased' }).eq('customer_id', customerId).eq('status', 'active'),
    db.from('segment_members').delete().eq('customer_id', customerId),
  ]);
  const failed = steps.filter((s) => s.error).map((s) => s.error!.message);
  if (failed.length) console.error(`[marketing] anonymize ${customerId}: ${failed.join('; ')}`);
  await db.from('audit_log').insert({ actor_id: actorId, entity: 'customer', entity_id: customerId, action: 'anonymized', data: { ledger_rows: ledger?.length ?? 0, partial_failures: failed.length } });
  return { ok: true };
}
