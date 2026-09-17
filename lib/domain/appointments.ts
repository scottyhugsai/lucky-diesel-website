import 'server-only';
import { cancelScheduled, emit } from '@/lib/automations/engine';
import { createAdminClient } from '@/lib/supabase/admin';
import { availableSlots, type Slot } from '@/lib/scheduling/slots';
import type { DomainResult } from './work-orders';

type Db = ReturnType<typeof createAdminClient>;

async function rulesAndBookings(db: Db, date: string) {
  const { data: settings } = await db.from('shop_settings').select('*').eq('id', 1).maybeSingle();
  const dayStart = new Date(`${date}T00:00:00Z`);
  const { data: booked } = await db
    .from('appointments')
    .select('starts_at, ends_at')
    .not('status', 'in', '(cancelled,no_show)')
    .gte('starts_at', new Date(dayStart.getTime() - 86_400_000).toISOString())
    .lt('starts_at', new Date(dayStart.getTime() + 2 * 86_400_000).toISOString());
  return {
    rules: {
      openHour: settings?.open_hour ?? 8,
      closeHour: settings?.close_hour ?? 17,
      openDays: settings?.open_days ?? [1, 2, 3, 4, 5],
      slotMinutes: settings?.slot_minutes ?? 60,
      bayCount: settings?.bay_count ?? 3,
      fleetReservedBays: settings?.fleet_reserved_bays ?? 0,
      fleetReleaseHours: settings?.fleet_release_hours ?? 24,
    },
    booked: (booked ?? []).map((b) => ({ startsAt: new Date(b.starts_at), endsAt: new Date(b.ends_at) })),
  };
}

export async function getAvailableSlots(date: string, { priority = false }: { priority?: boolean } = {}): Promise<Slot[]> {
  const db = createAdminClient();
  const { rules, booked } = await rulesAndBookings(db, date);
  return availableSlots(date, rules, booked, new Date(), priority);
}

/** Customers on an active fleet account with priority service can use reserved fleet bays. */
export async function isPriorityCustomer(customerId: string | null | undefined): Promise<boolean> {
  if (!customerId) return false;
  const { data } = await createAdminClient().from('customers').select('fleet_accounts!customers_fleet_account_id_fkey(priority, stage, active)').eq('id', customerId).maybeSingle();
  const fleet = data?.fleet_accounts;
  return Boolean(fleet?.priority && fleet.active && fleet.stage === 'active');
}

export interface BookingInput {
  customerId: string;
  vehicleId: string | null;
  serviceId: string | null;
  serviceLabel: string;
  date: string;
  startsAt: string;
  notes?: string;
  workOrderId?: string | null;
}

/** Books a slot after re-checking it's still free, then sends confirmation and schedules reminders. */
export async function bookAppointment(input: BookingInput): Promise<DomainResult<{ appointmentId: string }>> {
  const db = createAdminClient();
  const slots = await getAvailableSlots(input.date, { priority: await isPriorityCustomer(input.customerId) });
  const slot = slots.find((s) => s.startsAt.toISOString() === new Date(input.startsAt).toISOString());
  if (!slot) return { ok: false, error: 'That time was just taken. Pick another slot.' };

  const { data, error } = await db
    .from('appointments')
    .insert({
      customer_id: input.customerId,
      vehicle_id: input.vehicleId,
      service_id: input.serviceId,
      service_label: input.serviceLabel,
      starts_at: slot.startsAt.toISOString(),
      ends_at: slot.endsAt.toISOString(),
      notes: input.notes ?? null,
      work_order_id: input.workOrderId ?? null,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Could not book.' };

  await db.from('leads').update({ status: 'booked', converted_at: new Date().toISOString() }).eq('customer_id', input.customerId).in('status', ['new', 'contacted']);
  await emit({ name: 'appointment.booked', subjectType: 'appointment', subjectId: data.id });
  return { ok: true, data: { appointmentId: data.id } };
}

export async function cancelAppointment(appointmentId: string): Promise<DomainResult> {
  const db = createAdminClient();
  const { error } = await db.from('appointments').update({ status: 'cancelled' }).eq('id', appointmentId);
  if (error) return { ok: false, error: error.message };
  await cancelScheduled('appointment', appointmentId);
  return { ok: true, data: undefined };
}
