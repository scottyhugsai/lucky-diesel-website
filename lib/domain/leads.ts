import 'server-only';
import { emit } from '@/lib/automations/engine';
import { SMS_CONSENT_VERSION, type Lead } from '@/lib/lead';
import { createAdminClient } from '@/lib/supabase/admin';
import type { DomainResult } from './work-orders';

type Db = ReturnType<typeof createAdminClient>;

/** Finds a customer by email or phone, creating one if new. Consent is only ever added, never silently removed. */
export async function findOrCreateCustomer(
  db: Db,
  person: { fullName: string; email: string; phone: string; smsConsent: boolean; source: string },
): Promise<DomainResult<{ customerId: string; isNew: boolean }>> {
  const email = person.email.toLowerCase();
  // Two parameterized lookups rather than an .or() filter string built from user input.
  const { data: byEmail } = await db.from('customers').select('id').eq('email', email).limit(1);
  const { data: byPhone } = byEmail?.length ? { data: [] } : await db.from('customers').select('id').eq('phone', person.phone).limit(1);
  const existing = byEmail?.[0] ?? byPhone?.[0];
  const consentPatch = person.smsConsent
    ? { sms_consent: true, sms_consent_at: new Date().toISOString(), sms_consent_version: SMS_CONSENT_VERSION, sms_opted_out_at: null }
    : {};

  if (existing) {
    if (person.smsConsent) await db.from('customers').update(consentPatch).eq('id', existing.id);
    return { ok: true, data: { customerId: existing.id, isNew: false } };
  }

  const { data, error } = await db
    .from('customers')
    .insert({ full_name: person.fullName, email, phone: person.phone, source: person.source, ...consentPatch })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not save customer.' };
  return { ok: true, data: { customerId: data.id, isNew: true } };
}

/** Website service request → customer + lead, then owner alert, auto-reply and follow-ups. */
export async function createWebsiteLead(lead: Lead, meta: { ip: string | null }): Promise<DomainResult<{ leadId: string }>> {
  const db = createAdminClient();
  const customer = await findOrCreateCustomer(db, {
    fullName: lead.name, email: lead.email, phone: lead.phone, smsConsent: lead.smsConsent, source: 'website',
  });
  if (!customer.ok) return customer;

  const { data, error } = await db
    .from('leads')
    .insert({
      customer_id: customer.data.customerId,
      full_name: lead.name,
      email: lead.email.toLowerCase(),
      phone: lead.phone,
      platform: lead.platformId,
      platform_label: lead.platformLabel,
      mileage: lead.mileage,
      service_id: lead.serviceId,
      service_label: lead.serviceLabel,
      details: lead.details,
      sms_consent: lead.smsConsent,
      consent_ip: lead.smsConsent ? meta.ip : null,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not save lead.' };

  await emit({ name: 'lead.created', subjectType: 'lead', subjectId: data.id });
  return { ok: true, data: { leadId: data.id } };
}
