import { describe, expect, test } from 'vitest';
import { availableSlots, type SlotRules } from './slots';

const rules: SlotRules = { openHour: 8, closeHour: 12, openDays: [1, 2, 3, 4, 5], slotMinutes: 60, bayCount: 2 };
// Wednesday 2026-09-16 in Eastern time (UTC-4).
const wednesday = '2026-09-16';
const earlyMorning = new Date('2026-09-16T10:00:00Z'); // 6am Eastern

describe('availableSlots', () => {
  test('lists every open hourly slot for an empty day', () => {
    const slots = availableSlots(wednesday, rules, [], earlyMorning);
    expect(slots.map((s) => s.label)).toEqual(['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM']);
    expect(slots[0]!.startsAt.toISOString()).toBe('2026-09-16T12:00:00.000Z');
  });

  test('removes a slot once every bay is booked', () => {
    const booked = [
      { startsAt: new Date('2026-09-16T13:00:00Z'), endsAt: new Date('2026-09-16T14:00:00Z') },
      { startsAt: new Date('2026-09-16T12:30:00Z'), endsAt: new Date('2026-09-16T14:30:00Z') },
    ];
    const labels = availableSlots(wednesday, rules, booked, earlyMorning).map((s) => s.label);
    expect(labels).not.toContain('9:00 AM');
    expect(labels).toContain('8:00 AM');
  });

  test('returns nothing on closed days', () => {
    expect(availableSlots('2026-09-19', rules, [], earlyMorning)).toEqual([]);
  });

  test('hides slots that have already started', () => {
    const tenThirty = new Date('2026-09-16T14:30:00Z');
    expect(availableSlots(wednesday, rules, [], tenThirty).map((s) => s.label)).toEqual(['11:00 AM']);
  });

  test('ignores a malformed date', () => {
    expect(availableSlots('not-a-date', rules, [], earlyMorning)).toEqual([]);
  });
});

describe('priority fleet bays', () => {
  const reserved: SlotRules = { ...rules, fleetReservedBays: 1, fleetReleaseHours: 24 };
  const oneBooked = [{ startsAt: new Date('2026-09-16T13:00:00Z'), endsAt: new Date('2026-09-16T14:00:00Z') }];
  const twoDaysBefore = new Date('2026-09-14T10:00:00Z');

  test('holds the reserved bay from regular bookings until the release window', () => {
    expect(availableSlots(wednesday, reserved, oneBooked, twoDaysBefore).map((s) => s.label)).not.toContain('9:00 AM');
    expect(availableSlots(wednesday, reserved, oneBooked, earlyMorning).map((s) => s.label)).toContain('9:00 AM');
  });

  test('priority fleets can book the reserved bay any time', () => {
    expect(availableSlots(wednesday, reserved, oneBooked, twoDaysBefore, true).map((s) => s.label)).toContain('9:00 AM');
  });

  test('never reserves every bay', () => {
    const greedy: SlotRules = { ...rules, fleetReservedBays: 5 };
    expect(availableSlots(wednesday, greedy, [], twoDaysBefore)).toHaveLength(4);
  });
});
