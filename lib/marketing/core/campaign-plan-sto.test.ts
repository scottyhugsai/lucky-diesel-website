import { describe, expect, test } from 'vitest';
import { bestSendHour, estimateSmsCostCents, optimizedSendTime } from './campaign-plan';

// September: Eastern is UTC-4.
const et = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 8, day, hour + 4, minute));
const window = { startHour: 9, endHour: 20, timeZone: 'America/New_York' };

describe('send-time optimization', () => {
  test('best hour is the most common engaged hour inside the window', () => {
    expect(bestSendHour([et(1, 18, 5), et(3, 18, 40), et(4, 7), et(5, 7), et(6, 7), et(9, 12)], window)).toBe(18);
    expect(bestSendHour([et(1, 18)], window)).toBeNull();
  });

  test('moves the send to that hour within a day', () => {
    expect(optimizedSendTime(et(16, 10), 18, window).toISOString()).toBe(et(16, 18).toISOString());
    expect(optimizedSendTime(et(16, 19, 30), 12, window).toISOString()).toBe(et(17, 12).toISOString());
    expect(optimizedSendTime(et(16, 10), null, window).toISOString()).toBe(et(16, 10).toISOString());
  });
});

describe('estimateSmsCostCents', () => {
  test('recipients × segments × fee, MMS flat', () => {
    expect(estimateSmsCostCents({ recipients: 400, segments: 2, segmentFeeMillicents: 830, mmsFeeMillicents: 2000, hasMedia: false })).toBe(664);
    expect(estimateSmsCostCents({ recipients: 400, segments: 2, segmentFeeMillicents: 830, mmsFeeMillicents: 2000, hasMedia: true })).toBe(800);
  });
});
