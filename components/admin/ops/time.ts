import { SHOP_TIME_ZONE } from '@/lib/format';

/* Shop-local calendar maths. Dates are YYYY-MM-DD strings in the shop's time zone. */

const DAY_MS = 86_400_000;

export function shopDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** Minutes since shop-local midnight. */
export function shopMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: SHOP_TIME_ZONE, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function addDays(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00Z`);
  return new Date(base.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function mondayOf(date: string): string {
  const day = weekday(date);
  return addDays(date, day === 0 ? -6 : 1 - day);
}

export function dayLabel(date: string, style: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: style === 'short' ? 'short' : 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? 'pm' : 'am';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${suffix}`;
}

/** "12 min ago" style age, compact. */
export function ageLabel(from: string | Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(from).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
