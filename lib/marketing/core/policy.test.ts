import { describe, expect, test } from 'vitest';
import {
  intersectWindows, isCapReached, isMarketingAutomationKey, isWithinWindow, nextSendTime, normalizeAddress, normalizePhone, phoneTail, quietHoursWindow,
} from './policy';

// September: Eastern is UTC-4.
const eastern = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 8, day, hour + 4, minute));

describe('quiet hours (8am–9pm ET)', () => {
  const legal = quietHoursWindow();

  test('allows 8:00 and 20:59, blocks 21:00 and 7:59', () => {
    expect(isWithinWindow(eastern(16, 8), legal)).toBe(true);
    expect(isWithinWindow(eastern(16, 20, 59), legal)).toBe(true);
    expect(isWithinWindow(eastern(16, 21), legal)).toBe(false);
    expect(isWithinWindow(eastern(16, 7, 59), legal)).toBe(false);
  });

  test('pushes late sends to 8am the next day and early sends to 8am the same day', () => {
    expect(nextSendTime(eastern(16, 22, 30), legal).toISOString()).toBe(eastern(17, 8).toISOString());
    expect(nextSendTime(eastern(16, 5, 15), legal).toISOString()).toBe(eastern(16, 8).toISOString());
  });

  test('leaves in-window times untouched', () => {
    const noon = eastern(16, 12, 34);
    expect(nextSendTime(noon, legal)).toEqual(noon);
  });

  test('a campaign window never widens the legal window', () => {
    const narrow = intersectWindows({ startHour: 6, endHour: 23 }, legal);
    expect(narrow).toMatchObject({ startHour: 8, endHour: 21 });
    expect(intersectWindows({ startHour: 9, endHour: 20 }, legal)).toMatchObject({ startHour: 9, endHour: 20 });
  });

  test('handles the DST change in November', () => {
    // 2026-11-01 is the fall-back day; 11pm EST on Oct 31 → 8am EST Nov 1.
    const late = new Date('2026-11-01T03:00:00Z');
    const next = nextSendTime(late, legal);
    expect(isWithinWindow(next, legal)).toBe(true);
    expect(next.getTime() - late.getTime()).toBeLessThan(12 * 3_600_000);
  });
});

describe('frequency caps', () => {
  test('max 2 marketing texts per week', () => {
    expect(isCapReached(1, { maxPerWeek: 2 })).toBe(false);
    expect(isCapReached(2, { maxPerWeek: 2 })).toBe(true);
    expect(isCapReached(0, { maxPerWeek: 0 })).toBe(true);
  });
});

describe('purpose detection', () => {
  test('mkt_ automations and campaign sends are marketing; everything else transactional', () => {
    expect(isMarketingAutomationKey('mkt_win_back_6m')).toBe(true);
    expect(isMarketingAutomationKey('campaign:0b6e5b3e-0000-4000-8000-000000000000')).toBe(true);
    expect(isMarketingAutomationKey('review_request')).toBe(false);
    expect(isMarketingAutomationKey(null)).toBe(false);
  });
});

describe('addresses', () => {
  test('normalizes phones and emails', () => {
    expect(normalizePhone('(843) 555-0142')).toBe('+18435550142');
    expect(normalizePhone('+1 843 555 0142')).toBe('+18435550142');
    expect(normalizePhone('')).toBe('');
    expect(phoneTail('+1 (843) 555-0142')).toBe('8435550142');
    expect(normalizeAddress('email', ' Cody@Example.COM ')).toBe('cody@example.com');
  });
});
