import Link from 'next/link';
import { timeOnly } from '@/lib/format';
import { APPOINTMENT_TONE, type DayPlan } from './calendar-layout';
import { CapacityBar } from './CapacityBar';
import { dayLabel } from './time';

interface CalendarDayListProps {
  days: DayPlan[];
  activeDate: string;
  today: string;
  bays: number;
  openDays: number[];
  dayHref: (date: string) => string;
  hrefFor: (appointmentId: string) => string;
  selectedId?: string;
}

/** Phone view: a day switcher and that day's appointments as a list. */
export function CalendarDayList({ days, activeDate, today, bays, openDays, dayHref, hrefFor, selectedId }: CalendarDayListProps) {
  const day = days.find((d) => d.date === activeDate) ?? days[0]!;
  const closed = !openDays.includes(new Date(`${day.date}T12:00:00Z`).getUTCDay());
  return (
    <div>
      <nav aria-label="Day" className="grid grid-cols-6 gap-1">
        {days.map((d) => {
          const [weekday, date] = dayLabel(d.date).split(', ');
          const active = d.date === day.date;
          return (
            <Link
              key={d.date}
              href={dayHref(d.date)}
              scroll={false}
              aria-current={active ? 'date' : undefined}
              className={`flex flex-col items-center rounded-sm border py-2 text-xs font-semibold ${active ? 'border-clover bg-clover text-carbon' : d.date === today ? 'border-clover/40 text-clover' : 'border-line text-chalk/70'}`}
            >
              <span className="uppercase tracking-wider">{weekday}</span>
              <span className="tabular-nums">{date?.split(' ')[1]}</span>
              <span className={`mt-1 size-1.5 rounded-full ${d.items.length ? (active ? 'bg-carbon' : 'bg-clover') : 'bg-transparent'}`} aria-hidden="true" />
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-md border border-line bg-carbon-2 p-4">
        <p className="display text-2xl not-italic">{dayLabel(day.date, 'long')}</p>
        {closed ? <p className="mt-1 text-sm text-steel">Shop closed</p> : <CapacityBar utilisation={day.utilisation} peak={day.peak} bays={bays} />}
        {day.items.length === 0 ? (
          <p className="mt-4 text-sm text-steel">No appointments.</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {day.items.map((a) => (
              <li key={a.id}>
                <Link href={hrefFor(a.id)} scroll={false} className={`grid grid-cols-[4.25rem_1fr] gap-3 rounded-sm border p-3 ${APPOINTMENT_TONE[a.status] ?? ''} ${a.id === selectedId ? 'ring-2 ring-clover' : ''}`}>
                  <span className="text-sm font-bold tabular-nums">{timeOnly(a.starts_at)}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{a.customerName}</span>
                    <span className="block truncate text-xs opacity-80">{a.service_label} · {a.vehicle}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
