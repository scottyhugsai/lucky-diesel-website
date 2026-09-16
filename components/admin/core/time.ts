import { shopOffsetMinutes } from './parse';

const DAY_MS = 86_400_000;

/** Start/end (ISO) of the shop's calendar day containing `at`. */
export function shopDayRange(at: Date): { start: string; end: string } {
  const offset = shopOffsetMinutes(at) * 60_000;
  const wall = new Date(at.getTime() + offset);
  const wallMidnight = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
  const start = new Date(wallMidnight - offset);
  return { start: start.toISOString(), end: new Date(start.getTime() + DAY_MS).toISOString() };
}

export function ageLabel(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/**
 * The request's clock reading for Server Components. They render once per
 * request, so a single timestamp keeps overdue/age checks consistent on a page.
 */
export function requestNow(): number {
  return Date.now();
}
