import { shopDate, shopMinutes } from './time';

export interface CalendarAppointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  service_label: string;
  customerName: string;
  vehicle: string;
}

export interface PlacedAppointment extends CalendarAppointment {
  lane: number;
  startMin: number;
  endMin: number;
}

export interface DayPlan {
  date: string;
  items: PlacedAppointment[];
  laneCount: number;
  peak: number;
  utilisation: number;
}

const INACTIVE = new Set(['cancelled', 'no_show']);

/** Places a day's appointments into bay lanes (first free lane wins) and measures capacity. */
export function planDay(date: string, appointments: CalendarAppointment[], bays: number, openHour: number, closeHour: number): DayPlan {
  const items = appointments
    .filter((a) => shopDate(new Date(a.starts_at)) === date)
    .map((a) => ({ ...a, startMin: shopMinutes(new Date(a.starts_at)), endMin: shopMinutes(new Date(a.ends_at)) || 24 * 60 }))
    .sort((a, b) => a.startMin - b.startMin);

  const laneEnds: number[] = [];
  const placed: PlacedAppointment[] = items.map((item) => {
    const lane = laneEnds.findIndex((end) => end <= item.startMin);
    const index = lane === -1 ? laneEnds.length : lane;
    laneEnds[index] = item.endMin;
    return { ...item, lane: index };
  });

  const active = placed.filter((a) => !INACTIVE.has(a.status));
  let peak = 0;
  for (const a of active) {
    const overlapping = active.filter((b) => b.startMin < a.endMin && b.endMin > a.startMin).length;
    peak = Math.max(peak, overlapping);
  }
  const bookedMinutes = active.reduce((sum, a) => sum + (a.endMin - a.startMin), 0);
  const capacityMinutes = Math.max(1, bays * (closeHour - openHour) * 60);

  return { date, items: placed, laneCount: Math.max(1, laneEnds.length), peak, utilisation: Math.min(1, bookedMinutes / capacityMinutes) };
}

export const APPOINTMENT_TONE: Record<string, string> = {
  scheduled: 'border-sky-400/50 bg-sky-400/15 text-sky-100',
  confirmed: 'border-clover/60 bg-clover/15 text-chalk',
  checked_in: 'border-amber-400/50 bg-amber-400/15 text-amber-100',
  completed: 'border-line bg-gunmetal text-chalk/60',
  cancelled: 'border-danger/30 bg-danger/5 text-chalk/40 line-through',
  no_show: 'border-danger/40 bg-danger/10 text-danger/80',
};
