import { describe, expect, test } from 'vitest';
import { dayAgo, isDailyCapReached, isWithinAll, nextSendTimeAll, recipientRules, recipientWindows, throttleAllowance } from './policy';

// September: Eastern UTC-4, Central UTC-5, Pacific UTC-7.
const utc = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 8, day, hour, minute));
const base = { startHour: 8, endHour: 21 };

describe('recipientRules', () => {
  test('maps area codes to zones and 8pm states', () => {
    expect(recipientRules('+18439959252')).toEqual({ timeZones: ['America/New_York'], strictState: null });
    expect(recipientRules('(214) 555-0100')).toEqual({ timeZones: ['America/Chicago'], strictState: null });
    expect(recipientRules('305-555-0100').strictState).toBe('FL');
    expect(recipientRules('9185550100')).toEqual({ timeZones: ['America/Chicago'], strictState: 'OK' });
    expect(recipientRules('8505550100').timeZones).toEqual(['America/New_York', 'America/Chicago']);
  });

  test('unknown or malformed numbers fall back to the shop zone', () => {
    expect(recipientRules('555', 'America/Denver').timeZones).toEqual(['America/Denver']);
    expect(recipientRules(null).timeZones).toEqual(['America/New_York']);
  });
});

describe('recipient windows', () => {
  test('Florida stops at 8pm local', () => {
    const windows = recipientWindows(base, recipientRules('3055550100'));
    expect(isWithinAll(utc(16, 23, 59), windows)).toBe(true); // 7:59pm ET
    expect(isWithinAll(utc(17, 0, 0), windows)).toBe(false); // 8:00pm ET
  });

  test('a Texas recipient waits for 8am Central', () => {
    const windows = recipientWindows(base, recipientRules('2145550100'));
    expect(isWithinAll(utc(16, 12, 30), windows)).toBe(false); // 7:30am CT
    expect(nextSendTimeAll(utc(16, 12, 30), windows).toISOString()).toBe(utc(16, 13).toISOString());
  });

  test('split area codes must fit both zones', () => {
    const windows = recipientWindows(base, recipientRules('8505550100'));
    // 8:30am ET is 7:30am CT → wait for 8am CT (9am ET).
    expect(nextSendTimeAll(utc(16, 12, 30), windows).toISOString()).toBe(utc(16, 13).toISOString());
    // 7:30pm ET is fine in CT but past the FL 8pm cap? 7:30pm < 8pm → allowed.
    expect(isWithinAll(utc(16, 23, 30), windows)).toBe(true);
  });
});

describe('daily cap and throttle', () => {
  test('0 turns the daily cap off', () => {
    expect(isDailyCapReached(5, 0)).toBe(false);
    expect(isDailyCapReached(1, 1)).toBe(true);
    expect(isDailyCapReached(0, 1)).toBe(false);
    expect(dayAgo(utc(16, 12)).toISOString()).toBe(utc(15, 12).toISOString());
  });

  test('throttle allowance never goes negative or above the batch', () => {
    expect(throttleAllowance(60, 10, 500)).toBe(50);
    expect(throttleAllowance(60, 70, 500)).toBe(0);
    expect(throttleAllowance(6000, 0, 200)).toBe(200);
  });
});
