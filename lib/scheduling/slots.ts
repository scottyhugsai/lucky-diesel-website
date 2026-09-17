import { SHOP_TIME_ZONE } from '@/lib/format';

export interface SlotRules {
  openHour: number;
  closeHour: number;
  /** 0 = Sunday … 6 = Saturday */
  openDays: number[];
  slotMinutes: number;
  bayCount: number;
  /** Bays held for priority fleet accounts until `fleetReleaseHours` before the slot. */
  fleetReservedBays?: number;
  fleetReleaseHours?: number;
}

export interface BookedRange {
  startsAt: Date;
  endsAt: Date;
}

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  label: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** UTC offset in minutes for the shop's time zone at a given instant (e.g. -240 for EDT). */
function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The instant a wall-clock time occurs in the shop's time zone. */
export function shopWallTime(date: string, hour: number, minute = 0, timeZone = SHOP_TIME_ZONE): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const guess = new Date(Date.UTC(y, m - 1, d, hour, minute));
  return new Date(guess.getTime() - zoneOffsetMinutes(guess, timeZone) * 60_000);
}

/** Bays a booking may use: priority fleets get all; others lose reserved bays until the release window. */
export function bookableBays(rules: SlotRules, startsAt: Date, now: Date, isPriority: boolean): number {
  const reserved = Math.min(Math.max(0, rules.fleetReservedBays ?? 0), Math.max(0, rules.bayCount - 1));
  if (isPriority || reserved === 0) return rules.bayCount;
  const released = startsAt.getTime() - now.getTime() <= (rules.fleetReleaseHours ?? 24) * 3_600_000;
  return released ? rules.bayCount : rules.bayCount - reserved;
}

/** Open slots for one shop-local date, given existing bookings and bay capacity. */
export function availableSlots(date: string, rules: SlotRules, booked: BookedRange[], now = new Date(), isPriority = false): Slot[] {
  if (!DATE_PATTERN.test(date)) return [];
  const noon = shopWallTime(date, 12);
  if (Number.isNaN(noon.getTime())) return [];
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (!rules.openDays.includes(weekday)) return [];

  const label = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: SHOP_TIME_ZONE });
  const slots: Slot[] = [];
  for (let minutes = rules.openHour * 60; minutes + rules.slotMinutes <= rules.closeHour * 60; minutes += rules.slotMinutes) {
    const startsAt = shopWallTime(date, Math.floor(minutes / 60), minutes % 60);
    const endsAt = new Date(startsAt.getTime() + rules.slotMinutes * 60_000);
    if (startsAt <= now) continue;
    const overlapping = booked.filter((b) => b.startsAt < endsAt && b.endsAt > startsAt).length;
    if (overlapping >= bookableBays(rules, startsAt, now, isPriority)) continue;
    slots.push({ startsAt, endsAt, label: label.format(startsAt) });
  }
  return slots;
}
