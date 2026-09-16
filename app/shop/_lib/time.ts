import { SHOP_TIME_ZONE } from '@/lib/format';

/* Day boundaries in the shop's time zone, independent of the server's zone. */

const DATE_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** 'YYYY-MM-DD' for the shop-local calendar day of an instant. */
export function shopDateKey(value: Date | string): string {
  return DATE_KEY.format(new Date(value));
}

function offsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SHOP_TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The UTC instant of shop-local midnight starting the given 'YYYY-MM-DD'. */
export function shopMidnight(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - offsetMs(new Date(guess));
  return new Date(guess - offsetMs(new Date(first)));
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Monday of the shop-local week containing the date key. */
export function weekStartKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(dateKey, -((weekday + 6) % 7));
}

export function dayHeading(dateKey: string): { weekday: string; date: string } {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d, 12));
  return {
    weekday: new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(at),
    date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(at),
  };
}

export function hoursBetween(start: string, end: string | null, now: number): number {
  return Math.max(0, ((end ? new Date(end).getTime() : now) - new Date(start).getTime()) / 3_600_000);
}

export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return h ? `${h}h ${String(mm).padStart(2, '0')}m` : `${mm}m`;
}

/** Request-time clock for Server Components (kept out of render bodies). */
export function serverNow(): number {
  return Date.now();
}
