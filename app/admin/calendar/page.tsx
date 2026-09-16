import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { AppointmentPanel, type AppointmentDetail } from '@/components/admin/ops/AppointmentPanel';
import { CalendarDayList } from '@/components/admin/ops/CalendarDayList';
import { CalendarWeek } from '@/components/admin/ops/CalendarWeek';
import { planDay, type CalendarAppointment } from '@/components/admin/ops/calendar-layout';
import { isDate, isUuid } from '@/components/admin/ops/form';
import { addDays, dayLabel, mondayOf, shopDate } from '@/components/admin/ops/time';
import { ButtonLink, PageHeader, buttonClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { vehicleLabel } from '@/lib/format';
import { shopWallTime } from '@/lib/scheduling/slots';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Calendar | Lucky Diesel admin' };

type Search = Promise<{ week?: string; day?: string; appt?: string; booked?: string }>;

const DETAIL_FIELDS = 'id, starts_at, ends_at, status, service_label, notes, work_order_id, customers(id, full_name, phone, email, sms_consent), vehicles(year, make, model, engine_code, nickname), work_orders(number)';

export default async function CalendarPage({ searchParams }: { searchParams: Search }) {
  await requireRole('admin');
  const params = await searchParams;
  const today = shopDate();
  const monday = mondayOf(isDate(params.week) ? params.week : today);
  const dates = Array.from({ length: 6 }, (_, i) => addDays(monday, i));
  const activeDay = isDate(params.day) && dates.includes(params.day) ? params.day : dates.includes(today) ? today : monday;
  const selectedId = isUuid(params.appt) ? params.appt : undefined;

  const supabase = await createClient();
  const [{ data: settings }, { data: rows, error }, detail] = await Promise.all([
    supabase.from('shop_settings').select('bay_count, open_hour, close_hour, open_days').eq('id', 1).maybeSingle(),
    supabase
      .from('appointments')
      .select('id, starts_at, ends_at, status, service_label, customers(full_name), vehicles(year, make, model, engine_code, nickname)')
      .gte('starts_at', shopWallTime(monday, 0).toISOString())
      .lt('starts_at', shopWallTime(addDays(monday, 6), 0).toISOString())
      .order('starts_at'),
    selectedId ? supabase.from('appointments').select(DETAIL_FIELDS).eq('id', selectedId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const selected = detail.data as AppointmentDetail | null;
  const [{ data: runs }, { data: automations }] = selected
    ? await Promise.all([
        supabase.from('automation_runs').select('id, automation_key, subject_type, subject_id, status, scheduled_for, executed_at, detail').eq('subject_type', 'appointment').eq('subject_id', selected.id).order('scheduled_for'),
        supabase.from('automations').select('key, name'),
      ])
    : [{ data: [] }, { data: [] }];

  const bays = settings?.bay_count ?? 3;
  const openHour = settings?.open_hour ?? 8;
  const closeHour = settings?.close_hour ?? 17;
  const openDays = settings?.open_days ?? [1, 2, 3, 4, 5];
  const appointments: CalendarAppointment[] = (rows ?? []).map((r) => ({
    id: r.id, starts_at: r.starts_at, ends_at: r.ends_at, status: r.status, service_label: r.service_label,
    customerName: r.customers?.full_name ?? 'Customer', vehicle: vehicleLabel(r.vehicles),
  }));
  const days = dates.map((date) => planDay(date, appointments, bays, openHour, closeHour));
  const booked = appointments.filter((a) => !['cancelled', 'no_show'].includes(a.status)).length;

  const query = (extra: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const merged = { week: monday, day: activeDay, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) search.set(k, v);
    return `/admin/calendar?${search.toString()}`;
  };
  const hrefFor = (id: string) => query({ appt: id });
  const closeHref = query({});

  return (
    <>
      <PageHeader
        kicker="Calendar"
        title="Bay schedule"
        description={`${dayLabel(monday)} – ${dayLabel(addDays(monday, 5))} · ${booked} appointment${booked === 1 ? '' : 's'} · ${bays} bays`}
        actions={<ButtonLink href={`/admin/calendar/new?date=${activeDay >= today ? activeDay : today}`}><Plus className="size-4" aria-hidden="true" />New appointment</ButtonLink>}
      />

      {params.booked && (
        <p role="status" className="mb-4 rounded-sm border border-clover/40 bg-clover/10 px-4 py-3 text-sm font-semibold text-clover">
          Booked. Confirmation sent; 24h and 2h reminders are scheduled.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/admin/calendar?week=${addDays(monday, -7)}&day=${addDays(activeDay, -7)}`} className={buttonClass('secondary', 'sm')} aria-label="Previous week"><ChevronLeft className="size-4" aria-hidden="true" /></Link>
        <Link href="/admin/calendar" className={buttonClass('secondary', 'sm')}>Today</Link>
        <Link href={`/admin/calendar?week=${addDays(monday, 7)}&day=${addDays(activeDay, 7)}`} className={buttonClass('secondary', 'sm')} aria-label="Next week"><ChevronRight className="size-4" aria-hidden="true" /></Link>
        <p className="ml-1 text-sm text-steel">Shop hours {openHour}:00–{closeHour}:00</p>
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-danger">Couldn’t load appointments: {error.message}</p>}

      <div className={`grid gap-6 ${selected ? 'xl:grid-cols-[minmax(0,1fr)_22rem]' : ''}`}>
        {selected && (
          <div className="xl:order-2">
            <AppointmentPanel appointment={selected} runs={runs ?? []} names={new Map((automations ?? []).map((a) => [a.key, a.name]))} closeHref={closeHref} />
          </div>
        )}
        <div className="min-w-0 xl:order-1">
          <div className="md:hidden">
            <CalendarDayList days={days} activeDate={activeDay} today={today} bays={bays} openDays={openDays} dayHref={(date) => query({ day: date })} hrefFor={hrefFor} selectedId={selectedId} />
          </div>
          <div className="hidden md:block">
            <CalendarWeek days={days} openDays={openDays} openHour={openHour} closeHour={closeHour} bays={bays} today={today} selectedId={selectedId} hrefFor={hrefFor} />
          </div>
        </div>
      </div>
    </>
  );
}
