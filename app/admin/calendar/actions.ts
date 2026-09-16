'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { fail, isDate, isUuid, ok, oneOf, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import { bookAppointment, cancelAppointment, getAvailableSlots } from '@/lib/domain/appointments';
import { SERVICES } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export interface SlotOption {
  startsAt: string;
  label: string;
}

const MAX_NOTES = 500;

/** Open slots for a shop-local date, for the admin slot pickers. */
export async function loadSlots(date: string): Promise<{ slots: SlotOption[]; error?: string }> {
  await requireRole('admin');
  if (!isDate(date)) return { slots: [], error: 'Pick a valid date.' };
  const slots = await getAvailableSlots(date);
  return { slots: slots.map((s) => ({ startsAt: s.startsAt.toISOString(), label: s.label })) };
}

function refresh() {
  revalidatePath('/admin/calendar');
  revalidatePath('/admin/leads', 'layout');
  revalidatePath('/admin/automations');
  revalidatePath('/admin/messages');
}

export async function createAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const customerId = formData.get('customer_id');
  const vehicleId = formData.get('vehicle_id');
  const date = str(formData, 'date');
  const startsAt = str(formData, 'starts_at');
  const serviceId = str(formData, 'service_id');
  const notes = str(formData, 'notes');
  if (!isUuid(customerId)) return fail('Choose a customer.');
  if (vehicleId && !isUuid(vehicleId)) return fail('Choose one of the customer’s trucks.');
  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service) return fail('Choose a service.');
  if (!isDate(date) || Number.isNaN(new Date(startsAt).getTime())) return fail('Pick a date and an open time.');
  if (notes.length > MAX_NOTES) return fail(`Keep notes under ${MAX_NOTES} characters.`);

  const supabase = await createClient();
  if (isUuid(vehicleId)) {
    const { data: vehicle } = await supabase.from('vehicles').select('id').eq('id', vehicleId).eq('customer_id', customerId).maybeSingle();
    if (!vehicle) return fail('That truck doesn’t belong to this customer.');
  }

  const result = await bookAppointment({
    customerId,
    vehicleId: isUuid(vehicleId) ? vehicleId : null,
    serviceId: service.id,
    serviceLabel: service.name,
    date,
    startsAt,
    notes: notes || undefined,
  });
  if (!result.ok) return fail(result.error);
  refresh();
  redirect(`/admin/calendar?week=${date}&appt=${result.data.appointmentId}&booked=1`);
}

const STATUS_ACTIONS = ['confirmed', 'no_show', 'cancelled', 'checked_in', 'completed'] as const;

export async function setAppointmentStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = formData.get('appointment_id');
  const status = oneOf(formData.get('status'), STATUS_ACTIONS);
  if (!isUuid(id) || !status) return fail('Unknown appointment action.');

  if (status === 'cancelled') {
    const result = await cancelAppointment(id);
    if (!result.ok) return fail(result.error);
    refresh();
    return ok('Appointment cancelled. Its reminders were cancelled too.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
  if (error) return fail('Couldn’t update the appointment.');
  refresh();
  const labels: Record<typeof status, string> = {
    confirmed: 'Marked confirmed.', no_show: 'Marked as a no-show.', checked_in: 'Checked in.', completed: 'Marked complete.',
  };
  return ok(labels[status]);
}
