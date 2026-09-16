import { ArrowUpRight, Clock } from 'lucide-react';
import Link from 'next/link';
import { Badge, PageHeader } from '@/components/app/ui';
import { CheckInButton } from '@/components/shop/CheckInButton';
import { requireRole } from '@/lib/auth';
import type { Enums } from '@/lib/db/database.types';
import { firstName, timeOnly } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { engineName, truckName } from '../_lib/labels';
import { addDays, dayHeading, serverNow, shopDateKey, shopMidnight } from '../_lib/time';

export const metadata = { title: 'Schedule | Lucky Diesel Shop' };

type AppointmentStatus = Enums<'appointment_status'>;

const STATUS: Record<AppointmentStatus, { label: string; tone: 'neutral' | 'info' | 'good' | 'bad' | 'warn' }> = {
  scheduled: { label: 'Scheduled', tone: 'neutral' },
  confirmed: { label: 'Confirmed', tone: 'info' },
  checked_in: { label: 'Checked in', tone: 'good' },
  completed: { label: 'Completed', tone: 'good' },
  cancelled: { label: 'Cancelled', tone: 'bad' },
  no_show: { label: 'No-show', tone: 'warn' },
};

const DAYS_AHEAD = 7;

export default async function SchedulePage() {
  await requireRole('employee', 'admin');
  const todayKey = shopDateKey(new Date(serverNow()));
  const supabase = await createClient();

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, starts_at, ends_at, status, service_label, notes, customers(full_name), vehicles(year, make, model, platform, generation, engine_code), work_orders(id, number)')
    .gte('starts_at', shopMidnight(todayKey).toISOString())
    .lt('starts_at', shopMidnight(addDays(todayKey, DAYS_AHEAD)).toISOString())
    .order('starts_at');

  const days = Array.from({ length: DAYS_AHEAD }, (_, index) => {
    const key = addDays(todayKey, index);
    return { key, items: (appointments ?? []).filter((appointment) => shopDateKey(appointment.starts_at) === key) };
  });
  const [today, ...upcoming] = days as [(typeof days)[number], ...typeof days];

  return (
    <div className="grid gap-8">
      <PageHeader kicker="Next 7 days" title="Schedule" description="Who’s rolling in. Check trucks in when they hit the lot — it opens the job on your board." />
      {error && <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 p-4 text-danger">Couldn’t load the schedule.</p>}

      <section aria-labelledby="today-heading">
        <div className="mb-3 flex items-baseline gap-3">
          <h2 id="today-heading" className="display text-4xl text-clover">Today</h2>
          <span className="text-sm font-semibold text-steel">{dayHeading(today.key).weekday}, {dayHeading(today.key).date}</span>
        </div>
        {today.items.length ? (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {today.items.map((appointment) => {
              const status = STATUS[appointment.status];
              const canCheckIn = ['scheduled', 'confirmed'].includes(appointment.status);
              const who = firstName(appointment.customers?.full_name);
              return (
                <li key={appointment.id} className="grid gap-4 rounded-md border border-line bg-carbon-2 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="display flex items-center gap-2 text-4xl not-italic tabular-nums">
                      <Clock className="size-6 text-clover" aria-hidden="true" />
                      {timeOnly(appointment.starts_at)}
                    </p>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-chalk">{appointment.service_label}</p>
                    <p className="text-chalk/75">{truckName(appointment.vehicles)}{engineName(appointment.vehicles) ? ` · ${engineName(appointment.vehicles)}` : ''}</p>
                    <p className="mt-1 text-sm text-steel">{appointment.customers?.full_name ?? 'Walk-in'}</p>
                    {appointment.notes && <p className="mt-2 text-sm text-chalk/70">“{appointment.notes}”</p>}
                  </div>
                  {appointment.work_orders ? (
                    <Link href={`/shop/jobs/${appointment.work_orders.id}`} className="flex h-14 items-center justify-center gap-2 rounded-sm border border-chalk/20 font-semibold hover:border-clover hover:text-clover">
                      Open WO #{appointment.work_orders.number} <ArrowUpRight className="size-5" aria-hidden="true" />
                    </Link>
                  ) : canCheckIn ? (
                    <CheckInButton appointmentId={appointment.id} who={who} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-chalk/55">Nothing booked today. Shop’s all yours.</p>
        )}
      </section>

      <section aria-labelledby="upcoming-heading" className="grid gap-5">
        <h2 id="upcoming-heading" className="display text-3xl not-italic">Coming up</h2>
        {upcoming.map((day) => {
          const heading = dayHeading(day.key);
          return (
            <div key={day.key} className="grid gap-2 sm:grid-cols-[9rem_1fr] sm:gap-5">
              <h3 className="flex items-baseline gap-2 border-b border-line pb-1 sm:block sm:border-0">
                <span className="display block text-2xl not-italic">{heading.weekday}</span>
                <span className="text-sm font-semibold text-steel">{heading.date}</span>
              </h3>
              {day.items.length ? (
                <ul className="divide-y divide-line rounded-md border border-line bg-carbon-2">
                  {day.items.map((appointment) => (
                    <li key={appointment.id} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-3 py-3 sm:px-4">
                      <span className="font-mono text-sm font-semibold tabular-nums text-chalk">{timeOnly(appointment.starts_at)}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{appointment.service_label} · {firstName(appointment.customers?.full_name) || 'Walk-in'}</span>
                        <span className="block truncate text-sm text-steel">{truckName(appointment.vehicles)}</span>
                      </span>
                      <Badge tone={STATUS[appointment.status].tone}>{STATUS[appointment.status].label}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-2 text-sm text-chalk/40">Open day</p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
