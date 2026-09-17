import { describe, expect, test } from 'vitest';
import {
  assignVariant, broadcastSendTime, campaignWindow, dripStepTime, exitReason, nextStepOrder, pickWinner, sendDedupeKey, stableBucket, stepFor, variantsOf,
} from './campaign-plan';

const quiet = { start: 21, end: 8, timeZone: 'America/New_York' };
const window = campaignWindow({ send_window_start_hour: 9, send_window_end_hour: 20 }, quiet);
const eastern = (day: number, hour: number) => new Date(Date.UTC(2026, 8, day, hour + 4));
const ids = Array.from({ length: 2000 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);

describe('idempotency', () => {
  test('one dedupe key per campaign, step and customer', () => {
    expect(sendDedupeKey('c1', 1, 'u1')).toBe('campaign:c1:step:1:customer:u1');
    expect(sendDedupeKey('c1', 1, 'u1')).toBe(sendDedupeKey('c1', 1, 'u1'));
    expect(sendDedupeKey('c1', 2, 'u1')).not.toBe(sendDedupeKey('c1', 1, 'u1'));
  });

  test('bucketing is stable', () => {
    expect(stableBucket('abc')).toBe(stableBucket('abc'));
    expect(stableBucket('abc')).toBeGreaterThanOrEqual(0);
    expect(stableBucket('abc')).toBeLessThan(100);
  });
});

describe('A/B assignment', () => {
  test('without a test, everyone gets the first variant', () => {
    expect(assignVariant('c', 'u', ['A'], 50)).toBe('A');
    expect(assignVariant('c', 'u', ['B', 'A'], 0)).toBe('A');
  });

  test('is deterministic per recipient', () => {
    expect(assignVariant('camp', ids[5]!, ['A', 'B'], 20)).toBe(assignVariant('camp', ids[5]!, ['A', 'B'], 20));
  });

  test('puts about testPercent in the test, split roughly evenly; the rest wait for the winner', () => {
    const variants = ids.map((id) => assignVariant('camp-1', id, ['A', 'B'], 20));
    const a = variants.filter((v) => v === 'A').length;
    const b = variants.filter((v) => v === 'B').length;
    const held = variants.filter((v) => v === null).length;
    expect((a + b) / ids.length).toBeGreaterThan(0.15);
    expect((a + b) / ids.length).toBeLessThan(0.25);
    expect(Math.abs(a - b) / (a + b)).toBeLessThan(0.25);
    expect(held + a + b).toBe(ids.length);
  });

  test('100% splits everyone', () => {
    expect(ids.slice(0, 200).every((id) => assignVariant('c', id, ['A', 'B'], 100) !== null)).toBe(true);
  });
});

describe('winner selection', () => {
  test('highest click rate wins, not the most clicks', () => {
    expect(pickWinner([{ variant: 'A', sent: 100, clicks: 10, bookings: 1 }, { variant: 'B', sent: 40, clicks: 6, bookings: 0 }], 'click')).toBe('B');
  });

  test('booking metric uses bookings', () => {
    expect(pickWinner([{ variant: 'A', sent: 100, clicks: 10, bookings: 3 }, { variant: 'B', sent: 100, clicks: 20, bookings: 1 }], 'booking')).toBe('A');
  });

  test('ties and empty tests fall back to A', () => {
    expect(pickWinner([{ variant: 'B', sent: 10, clicks: 1, bookings: 0 }, { variant: 'A', sent: 10, clicks: 1, bookings: 0 }], 'click')).toBe('A');
    expect(pickWinner([{ variant: 'B', sent: 0, clicks: 0, bookings: 0 }, { variant: 'A', sent: 0, clicks: 0, bookings: 0 }], 'click')).toBe('A');
  });
});

describe('scheduling', () => {
  test('test cohort goes at launch; holdouts after the decision delay', () => {
    const at = eastern(18, 10);
    expect(broadcastSendTime(at, 'A', 240, window)).toEqual(at);
    expect(broadcastSendTime(at, null, 240, window).toISOString()).toBe(eastern(18, 14).toISOString());
  });

  test('a holdout decision landing after hours moves to the next morning window', () => {
    expect(broadcastSendTime(eastern(18, 18), null, 240, window).toISOString()).toBe(eastern(19, 9).toISOString());
  });

  test('drip steps are delayed from the previous step and kept inside the window', () => {
    expect(dripStepTime(eastern(18, 10), 3 * 24 * 60, window).toISOString()).toBe(eastern(21, 10).toISOString());
    expect(dripStepTime(eastern(18, 19), 120, window).toISOString()).toBe(eastern(19, 9).toISOString());
  });
});

describe('drip exits and steps', () => {
  test('exit conditions are opt-in per campaign', () => {
    const facts = { bookedSinceEnrollment: true, repliedSinceEnrollment: true, unsubscribed: false };
    expect(exitReason(['booked', 'replied', 'unsubscribed'], facts)).toBe('booked');
    expect(exitReason(['replied'], facts)).toBe('replied');
    expect(exitReason([], facts)).toBeNull();
    expect(exitReason(['booked', 'unsubscribed'], { ...facts, unsubscribed: true })).toBe('unsubscribed');
  });

  test('step lookup falls back to variant A, and next step skips gaps', () => {
    const steps = [{ step_order: 1, variant: 'A' }, { step_order: 1, variant: 'B' }, { step_order: 3, variant: 'A' }];
    expect(stepFor(steps, 1, 'B')?.variant).toBe('B');
    expect(stepFor(steps, 3, 'B')?.variant).toBe('A');
    expect(stepFor(steps, 2, 'A')).toBeNull();
    expect(nextStepOrder(steps, 1)).toBe(3);
    expect(nextStepOrder(steps, 3)).toBeNull();
    expect(variantsOf(steps)).toEqual(['A', 'B']);
  });
});
