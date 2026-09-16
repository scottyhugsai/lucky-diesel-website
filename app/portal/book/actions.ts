'use server';

import { revalidatePath } from 'next/cache';
import { bookingDates, NOTES_MAX } from '@/components/portal/booking';
import { getShopRules } from '@/components/portal/server';
import { requireRole } from '@/lib/auth';
import { bookAppointment } from '@/lib/domain/appointments';
import { dateTime } from '@/lib/format';
import { SERVICES } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export interface BookState {
  error?: string;
  message?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function bookService(_previous: BookState, formData: FormData): Promise<BookState> {
  const viewer = await requireRole('client');
  if (!viewer.customerId) return { error: 'Your login isn’t linked to a customer record yet. Call the shop.' };

  const vehicleId = String(formData.get('vehicleId') ?? '');
  const service = SERVICES.find((s) => s.id === formData.get('serviceId'));
  const date = String(formData.get('date') ?? '');
  const startsAt = String(formData.get('startsAt') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();

  if (!UUID.test(vehicleId)) return { error: 'Pick which truck is coming in.' };
  if (!service) return { error: 'Pick a service.' };
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) return { error: 'Pick a time.' };
  if (notes.length > NOTES_MAX) return { error: `Keep notes under ${NOTES_MAX} characters.` };
  const { openDays } = await getShopRules();
  if (!bookingDates(openDays).some((d) => d.value === date)) return { error: 'Pick a day within the next two weeks.' };

  // Ownership: the truck must be readable as this customer and belong to them.
  const supabase = await createClient();
  const { data: vehicle } = await supabase.from('vehicles').select('id, customer_id').eq('id', vehicleId).maybeSingle();
  if (!vehicle || vehicle.customer_id !== viewer.customerId) return { error: 'We couldn’t find that truck on your account.' };

  const result = await bookAppointment({
    customerId: viewer.customerId,
    vehicleId: vehicle.id,
    serviceId: service.id,
    serviceLabel: service.name,
    date,
    startsAt,
    notes: notes || undefined,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath('/portal/book');
  revalidatePath('/portal');
  return { message: `You’re booked: ${service.name}, ${dateTime(startsAt)}. We just sent a confirmation.` };
}
