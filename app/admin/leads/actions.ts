'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checked, fail, isDate, isUuid, ok, oneOf, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import type { Enums } from '@/lib/db/database.types';
import { bookAppointment } from '@/lib/domain/appointments';
import { findOrCreateCustomer } from '@/lib/domain/leads';
import { PLATFORMS, SERVICES } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const STATUSES: Enums<'lead_status'>[] = ['new', 'contacted', 'booked', 'won', 'lost'];

function refresh(leadId: string) {
  revalidatePath('/admin', 'layout');
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function updateLeadStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = formData.get('lead_id');
  const status = oneOf(formData.get('status'), STATUSES);
  if (!isUuid(id) || !status) return fail('Unknown lead or status.');

  const supabase = await createClient();
  const { data: lead } = await supabase.from('leads').select('contacted_at, converted_at').eq('id', id).maybeSingle();
  if (!lead) return fail('Lead not found.');

  const now = new Date().toISOString();
  const patch: { status: Enums<'lead_status'>; contacted_at?: string; converted_at?: string } = { status };
  if (status !== 'new' && !lead.contacted_at) patch.contacted_at = now;
  if ((status === 'booked' || status === 'won') && !lead.converted_at) patch.converted_at = now;

  const { error } = await supabase.from('leads').update(patch).eq('id', id);
  if (error) return fail('Couldn’t update the lead.');
  refresh(id);
  return ok(`Marked ${status}.`);
}

/** "Duramax — 2017–Present L5P 6.6L" → vehicle fields. Year and model stay unknown until check-in. */
function vehicleFromLead(platformId: string | null, platformLabel: string | null) {
  const platform = PLATFORMS.find((p) => p.id === platformId);
  const generation = platformLabel?.split(' — ')[1]?.trim() ?? null;
  const engineCode = generation?.match(/\b(LB7|LLY|LBZ|LMM|LML|L5P)\b/)?.[1] ?? null;
  return {
    platform: platform?.id ?? 'other',
    generation,
    make: platform?.name ?? null,
    model: generation ?? (platform ? null : platformLabel),
    engine_code: engineCode,
  };
}

export async function convertLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  const leadId = formData.get('lead_id');
  if (!isUuid(leadId)) return fail('Lead not found.');
  const service = SERVICES.find((s) => s.id === str(formData, 'service_id'));
  if (!service) return fail('Choose the service for the estimate.');
  const wantsBooking = checked(formData, 'book');
  const date = str(formData, 'date');
  const startsAt = str(formData, 'starts_at');
  if (wantsBooking && (!isDate(date) || !startsAt || Number.isNaN(new Date(startsAt).getTime()))) return fail('Pick a date and an open time, or untick “Book an appointment”.');

  const supabase = await createClient();
  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (!lead) return fail('Lead not found.');

  // Service role for the shared domain helper; the admin check above gates it.
  const customer = await findOrCreateCustomer(createAdminClient(), {
    fullName: lead.full_name, email: lead.email, phone: lead.phone, smsConsent: lead.sms_consent, source: lead.source,
  });
  if (!customer.ok) return fail(customer.error);
  const customerId = customer.data.customerId;

  const vehicleFields = vehicleFromLead(lead.platform, lead.platform_label);
  const vehicleQuery = supabase.from('vehicles').select('id').eq('customer_id', customerId).eq('platform', vehicleFields.platform);
  const { data: existingVehicle } = await (vehicleFields.generation ? vehicleQuery.eq('generation', vehicleFields.generation) : vehicleQuery.is('generation', null))
    .limit(1).maybeSingle();
  let vehicleId = existingVehicle?.id ?? null;
  if (!vehicleId) {
    const { data: vehicle, error } = await supabase
      .from('vehicles').insert({ customer_id: customerId, ...vehicleFields, mileage: Number.parseInt((lead.mileage ?? '').replace(/\D/g, ''), 10) || null })
      .select('id').single();
    if (error || !vehicle) return fail('Couldn’t add the truck.');
    vehicleId = vehicle.id;
  }

  const { data: existingJob } = await supabase.from('work_orders').select('id, number').eq('lead_id', lead.id).limit(1).maybeSingle();
  let job = existingJob;
  if (!job) {
    const { data, error } = await supabase
      .from('work_orders')
      .insert({ customer_id: customerId, vehicle_id: vehicleId, lead_id: lead.id, title: service.name, complaint: lead.details, status: 'estimate' })
      .select('id, number').single();
    if (error || !data) return fail('Couldn’t create the estimate.');
    job = data;
    await createAdminClient().from('audit_log').insert({ actor_id: viewer.userId, entity: 'work_order', entity_id: data.id, action: 'created_from_lead', data: { lead_id: lead.id } });
  }

  const now = new Date().toISOString();
  // Link the customer first so bookAppointment's lead update sees this lead.
  await supabase.from('leads').update({ customer_id: customerId, contacted_at: lead.contacted_at ?? now }).eq('id', lead.id);

  let outcome = 'estimate';
  if (wantsBooking) {
    const result = await bookAppointment({ customerId, vehicleId, serviceId: service.id, serviceLabel: service.name, date, startsAt, workOrderId: job.id });
    outcome = result.ok ? 'booked' : 'booking-failed';
  }
  await supabase.from('leads').update({ status: outcome === 'booked' ? 'booked' : 'won', converted_at: lead.converted_at ?? now }).eq('id', lead.id);

  refresh(lead.id);
  redirect(`/admin/leads/${lead.id}?converted=${outcome}`);
}
