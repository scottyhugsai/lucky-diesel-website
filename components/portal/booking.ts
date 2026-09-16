import { SHOP_TIME_ZONE } from '@/lib/format';

export const BOOKING_WINDOW_DAYS = 14;
export const NOTES_MAX = 500;

export interface BookingDate {
  value: string;
  weekday: string;
  day: string;
  month: string;
}

const isoDate = new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

/** Open shop days from today (shop time) through the booking window. */
export function bookingDates(openDays: readonly number[], now = new Date()): BookingDate[] {
  const [y, m, d] = isoDate.format(now).split('-').map(Number) as [number, number, number];
  const dates: BookingDate[] = [];
  for (let offset = 0; offset < BOOKING_WINDOW_DAYS; offset += 1) {
    const noonUtc = new Date(Date.UTC(y, m - 1, d + offset, 12));
    if (!openDays.includes(noonUtc.getUTCDay())) continue;
    const bits = Object.fromEntries(parts.formatToParts(noonUtc).map((p) => [p.type, p.value]));
    dates.push({ value: noonUtc.toISOString().slice(0, 10), weekday: bits.weekday ?? '', day: bits.day ?? '', month: bits.month ?? '' });
  }
  return dates;
}
