'use server';

import { headers } from 'next/headers';
import { bookAppointment } from '@/lib/domain/appointments';
import { findOrCreateCustomer } from '@/lib/domain/leads';
import { parseLead, type LeadField } from '@/lib/lead';
import { createAdminClient } from '@/lib/supabase/admin';

export interface BookingState {
  ok?: boolean;
  error?: string;
  errors?: Partial<Record<LeadField | 'slot', string>>;
  confirmation?: { firstName: string; when: string; service: string };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Public online booking: validates like the quote form, then customer → truck → lead (booked) → appointment. */
export async function bookOnline(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const raw = Object.fromEntries(formData.entries());
  const details = String(raw.details ?? '').trim();
  const parsed = parseLead({
    ...raw,
    details: details.length >= 5 ? details : 'Booked online',
    smsConsent: raw.smsConsent === 'on',
  });
  if (!parsed.ok) {
    if (parsed.spam) return { ok: true, confirmation: { firstName: '', when: '', service: '' } };
    return { errors: parsed.errors };
  }

  const date = String(raw.date ?? '');
  const startsAt = String(raw.startsAt ?? '');
  if (!DATE_PATTERN.test(date) || Number.isNaN(Date.parse(startsAt))) return { errors: { slot: 'Pick a day and time.' } };

  const lead = parsed.lead;
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const db = createAdminClient();

  const customer = await findOrCreateCustomer(db, {
    fullName: lead.name, email: lead.email, phone: lead.phone, smsConsent: lead.smsConsent, source: 'online booking',
  });
  if (!customer.ok) return { error: 'We couldn’t save your booking. Please call us.' };

  const generation = String(raw.generation ?? '');
  const { data: vehicle } = await db
    .from('vehicles')
    .insert({
      customer_id: customer.data.customerId,
      platform: lead.platformId,
      generation: generation || null,
      mileage: Number.parseInt(lead.mileage.replace(/\D/g, ''), 10) || null,
      nickname: null,
    })
    .select('id')
    .single();

  const booking = await bookAppointment({
    customerId: customer.data.customerId,
    vehicleId: vehicle?.id ?? null,
    serviceId: lead.serviceId,
    serviceLabel: lead.serviceLabel,
    date,
    startsAt,
    notes: details || undefined,
  });
  if (!booking.ok) return { errors: { slot: booking.error } };

  await db.from('leads').insert({
    customer_id: customer.data.customerId,
    full_name: lead.name,
    email: lead.email.toLowerCase(),
    phone: lead.phone,
    platform: lead.platformId,
    platform_label: lead.platformLabel,
    mileage: lead.mileage,
    service_id: lead.serviceId,
    service_label: lead.serviceLabel,
    details: details || null,
    sms_consent: lead.smsConsent,
    consent_ip: lead.smsConsent ? ip : null,
    status: 'booked',
    source: 'online booking',
    converted_at: new Date().toISOString(),
  });

  const when = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(new Date(startsAt));
  return { ok: true, confirmation: { firstName: lead.name.split(' ')[0] ?? '', when, service: lead.serviceLabel } };
}
