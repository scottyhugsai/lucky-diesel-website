import Link from 'next/link';
import { timeOnly } from '@/lib/format';
import { APPOINTMENT_TONE, type DayPlan } from './calendar-layout';
import { CapacityBar } from './CapacityBar';
import { dayLabel, hourLabel } from './time';

const HOUR_PX = 72;

interface CalendarWeekProps {
  days: DayPlan[];
  openDays: number[];
  openHour: number;
  closeHour: number;
  bays: number;
  today: string;
  selectedId?: string;
  hrefFor: (appointmentId: string) => string;
}

/** Desktop week grid: time rows, a column per day, appointments laid into bay lanes. */
export function CalendarWeek({ days, openDays, openHour, closeHour, bays, today, selectedId, hrefFor }: CalendarWeekProps) {
  const hours = Array.from({ length: Math.max(1, closeHour - openHour) }, (_, i) => openHour + i);
  const height = hours.length * HOUR_PX;

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-carbon-2">
      <div className="grid min-w-[860px]" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="sticky left-0 z-10 border-b border-line bg-carbon-2" />
        {days.map((day) => {
          const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay();
          const isToday = day.date === today;
          return (
            <div key={day.date} className={`border-b border-l border-line px-3 py-2.5 ${isToday ? 'bg-clover/[0.06]' : ''}`}>
              <p className={`text-xs font-bold uppercase tracking-widest ${isToday ? 'text-clover' : 'text-steel'}`}>{dayLabel(day.date)}</p>
              {openDays.includes(weekday) ? <CapacityBar utilisation={day.utilisation} peak={day.peak} bays={bays} /> : <p className="mt-1.5 text-xs text-steel">Closed</p>}
            </div>
          );
        })}

        <div className="relative sticky left-0 z-10 bg-carbon-2" style={{ height }}>
          {hours.map((hour, i) => (
            <span key={hour} className="absolute right-2 -translate-y-1/2 text-[0.65rem] font-semibold tabular-nums text-steel" style={{ top: i * HOUR_PX }}>
              {i === 0 ? '' : hourLabel(hour)}
            </span>
          ))}
        </div>
        {days.map((day) => {
          const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay();
          const closed = !openDays.includes(weekday);
          return (
            <div
              key={day.date}
              className={`relative border-l border-line ${closed ? 'bg-[repeating-linear-gradient(-45deg,transparent_0_8px,rgb(238_242_239/0.03)_8px_16px)]' : ''}`}
              style={{ height, backgroundImage: closed ? undefined : `repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px ${HOUR_PX}px)` }}
            >
              {day.items.map((a) => {
                const top = ((a.startMin - openHour * 60) / 60) * HOUR_PX;
                const itemHeight = Math.max(28, ((a.endMin - a.startMin) / 60) * HOUR_PX - 4);
                const width = 100 / day.laneCount;
                const selected = a.id === selectedId;
                return (
                  <Link
                    key={a.id}
                    href={hrefFor(a.id)}
                    scroll={false}
                    className={`absolute overflow-hidden rounded-sm border px-2 py-1 text-xs transition-shadow hover:z-10 hover:shadow-lg ${APPOINTMENT_TONE[a.status] ?? APPOINTMENT_TONE.scheduled} ${selected ? 'z-10 ring-2 ring-clover' : ''}`}
                    style={{ top: Math.max(0, top) + 2, height: itemHeight, left: `calc(${a.lane * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
                  >
                    <span className="block truncate font-bold">{a.customerName}</span>
                    <span className="block truncate opacity-80">{timeOnly(a.starts_at)} · {a.service_label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
