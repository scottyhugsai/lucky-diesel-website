import { describe, expect, test } from 'vitest';
import { estimateMilesPerMonth, isServiceDue, lifecycleStageFor, predictMileage, scoreLead } from './scoring';

const now = new Date('2026-09-17T15:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

describe('mileage prediction', () => {
  test('estimates a monthly rate from the first and last readings', () => {
    expect(estimateMilesPerMonth([{ at: ago(365), miles: 50_000 }, { at: ago(0), miles: 62_000 }])).toBe(1001); // 12,000 mi / 365 d × 30.44
    expect(estimateMilesPerMonth([{ at: ago(10), miles: 50_000 }, { at: ago(0), miles: 51_000 }])).toBeNull();
    expect(estimateMilesPerMonth([{ at: ago(100), miles: 60_000 }, { at: ago(0), miles: 50_000 }])).toBeNull();
    expect(estimateMilesPerMonth([{ at: ago(60), miles: 1 }, { at: ago(0), miles: 500_000 }])).toBe(6000);
  });

  test('projects today’s odometer, falling back to 1,000 mi/month', () => {
    expect(predictMileage([{ at: ago(365), miles: 50_000 }, { at: ago(182.6), miles: 56_000 }], now)).toBeGreaterThanOrEqual(61_990);
    expect(predictMileage([{ at: ago(365), miles: 50_000 }, { at: ago(182.6), miles: 56_000 }], now)).toBeLessThanOrEqual(62_010);
    expect(predictMileage([{ at: ago(30.44), miles: 10_000 }], now)).toBe(11_000);
    expect(predictMileage([], now)).toBeNull();
  });

  test('service is due at the interval minus the buffer', () => {
    expect(isServiceDue(86_999, 80_000)).toBe(false);
    expect(isServiceDue(87_000, 80_000)).toBe(true);
    expect(isServiceDue(null, 80_000)).toBe(false);
  });
});

describe('lead score', () => {
  const base = { serviceId: 'turbo', platform: 'duramax', source: 'referral', status: 'new', smsConsent: true, detailsLength: 80, createdAt: ago(0.1), now };
  test('rewards value, fit, source, recency and intent', () => {
    expect(scoreLead(base)).toBe(95);
    expect(scoreLead({ ...base, serviceId: 'maintenance', platform: 'other', source: 'yard sign', smsConsent: false, detailsLength: 0, createdAt: ago(30) })).toBe(15);
  });
  test('won/booked pin to 100, lost to 0', () => {
    expect(scoreLead({ ...base, status: 'booked' })).toBe(100);
    expect(scoreLead({ ...base, status: 'lost' })).toBe(0);
  });
});

describe('lifecycle stage', () => {
  const base = { paidVisits: 1, lastPaidAt: ago(30), lifetimeSpendCents: 50_000, tier: 'stock' as const, openLeads: 0, lostLeads: 0, now };
  test.each([
    [{ paidVisits: 0, openLeads: 1 }, 'lead'],
    [{ paidVisits: 0, lostLeads: 1 }, 'lost'],
    [{ paidVisits: 0 }, 'subscriber'],
    [{}, 'customer'],
    [{ paidVisits: 3 }, 'repeat'],
    [{ tier: 'stage_2' as const }, 'vip'],
    [{ lastPaidAt: ago(400), tier: 'full_build' as const }, 'lapsed'],
  ])('%o → %s', (patch, stage) => {
    expect(lifecycleStageFor({ ...base, ...patch })).toBe(stage);
  });
});
