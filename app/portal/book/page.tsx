import { CalendarCheck } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/components/app/ui';
import { BookingForm } from '@/components/portal/BookingForm';
import { NotLinked } from '@/components/portal/NotLinked';
import { bookingDates } from '@/components/portal/booking';
import { getShopRules } from '@/components/portal/server';
import { requireRole } from '@/lib/auth';
import { getAvailableSlots } from '@/lib/domain/appointments';
import { dateTime, vehicleLabel } from '@/lib/format';
import { BUSINESS, SERVICES } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Book service | Lucky Diesel' };

interface BookPageProps {
  searchParams: Promise<{ date?: string; vehicle?: string; service?: string }>;
}

export default async function BookPage({ searchParams }: BookPageProps) {
  const viewer = await requireRole('client');
  if (!viewer.customerId) return <NotLinked />;
  const query = await searchParams;
  const supabase = await createClient();
  const [{ data: vehicles }, { data: upcoming }, { openDays }] = await Promise.all([
    supabase.from('vehicles').select('id, year, make, model, engine_code, nickname').eq('customer_id', viewer.customerId).order('created_at'),
    supabase.from('appointments').select('id, service_label, starts_at, status, vehicle_id').eq('customer_id', viewer.customerId).in('status', ['scheduled', 'confirmed']).gte('starts_at', new Date().toISOString()).order('starts_at'),
    getShopRules(),
  ]);

  const dates = bookingDates(openDays);
  let selectedDate = dates.find((d) => d.value === query.date)?.value ?? '';
  let slots = selectedDate ? await getAvailableSlots(selectedDate) : [];
  // No day picked yet: open on the first day that still has an opening.
  for (const d of selectedDate ? [] : dates) {
    slots = await getAvailableSlots(d.value);
    selectedDate = d.value;
    if (slots.length) break;
  }
  const vehicleOptions = (vehicles ?? []).map((v) => ({ id: v.id, label: v.nickname ? `${v.nickname} — ${vehicleLabel(v)}` : vehicleLabel(v) }));
  const vehicleById = new Map((vehicles ?? []).map((v) => [v.id, v]));
  const initialVehicle = vehicleOptions.find((v) => v.id === query.vehicle)?.id ?? vehicleOptions[0]?.id ?? '';
  const initialService = SERVICES.find((s) => s.id === query.service)?.id ?? SERVICES[0]!.id;

  return (
    <div>
      <PageHeader kicker="Book service" title="Get on the schedule" description={`Pick a drop-off time. Need it sooner? Call or text ${BUSINESS.phoneDisplay}.`} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Booking form" className="min-w-0 rounded-md border border-line bg-carbon-2 p-4 sm:p-6">
          {vehicleOptions.length ? (
            <BookingForm
              vehicles={vehicleOptions}
              services={SERVICES.map((s) => ({ id: s.id, label: s.name }))}
              dates={dates}
              selectedDate={selectedDate}
              slots={slots.map((s) => ({ startsAt: s.startsAt.toISOString(), label: s.label }))}
              initialVehicle={initialVehicle}
              initialService={initialService}
            />
          ) : (
            <EmptyState title="No trucks on file">Call or text {BUSINESS.phoneDisplay} and we’ll add yours.</EmptyState>
          )}
        </section>
        <Card title="Upcoming" className="self-start">
          {upcoming?.length ? (
            <ul className="space-y-4">
              {upcoming.map((appt) => (
                <li key={appt.id} className="flex gap-3">
                  <CalendarCheck className="mt-0.5 size-5 shrink-0 text-clover" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">{appt.service_label}</p>
                    <p className="text-sm text-chalk/75">{dateTime(appt.starts_at)}</p>
                    <p className="text-xs text-steel">{vehicleLabel(vehicleById.get(appt.vehicle_id ?? ''))} · {appt.status === 'confirmed' ? 'Confirmed' : 'Scheduled'}</p>
                  </div>
                </li>
              ))}
              <li className="border-t border-line pt-3 text-xs text-steel">Need to change a time? Call or text {BUSINESS.phoneDisplay}.</li>
            </ul>
          ) : (
            <p className="text-chalk/60">Nothing booked yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
