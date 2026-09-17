import { describe, expect, test } from 'vitest';
import {
  costCentsFromSnapshot, discountedTotals, fleetPercentFor, isExpiringSoon, laborCentsFromSnapshot, leaderboardName, lintOffer, monthlyStatement,
  parseFleetTiers, parseTierPerks, partnerCodeStem, pointsForCredit, pointsRedemption, promoRoi, referralAskTargets, singleUseCode, type OfferDraft,
} from './promotions';

const DAY = 86_400_000;

describe('invoice totals with discounts', () => {
  test('tax shrinks in proportion and discount is capped', () => {
    expect(discountedTotals({ subtotalCents: 100_00, preDiscountTaxCents: 6_00, discountCents: 25_00 })).toEqual({ discountCents: 25_00, taxCents: 4_50, totalCents: 79_50 });
    expect(discountedTotals({ subtotalCents: 50_00, preDiscountTaxCents: 3_00, discountCents: 80_00 })).toEqual({ discountCents: 50_00, taxCents: 0, totalCents: 0 });
    expect(discountedTotals({ subtotalCents: 50_00, preDiscountTaxCents: 3_00, discountCents: 0 })).toEqual({ discountCents: 0, taxCents: 3_00, totalCents: 53_00 });
  });

  test('labor and cost from snapshots ignore junk rows', () => {
    const snap = [
      { kind: 'labor', quantity: 2.5, unit_price_cents: 150_00, unit_cost_cents: 0 },
      { kind: 'part', quantity: 1, unit_price_cents: 90_00, unit_cost_cents: 55_00 },
      null, 'x', { kind: 'labor', quantity: 'abc', unit_price_cents: 1 },
    ];
    expect(laborCentsFromSnapshot(snap)).toBe(375_00);
    expect(costCentsFromSnapshot(snap)).toBe(55_00);
    expect(laborCentsFromSnapshot({})).toBe(0);
  });
});

describe('pricing programs', () => {
  test('tier perks parse with defaults and clamps', () => {
    const perks = parseTierPerks({ stage_1: { perk: ' Free coffee ', labor_percent: 3 }, stage_2: { labor_percent: 99 } });
    expect(perks.stage_1).toEqual({ perk: 'Free coffee', laborPercent: 3 });
    expect(perks.stage_2).toEqual({ perk: '5% off labor', laborPercent: 5 });
    expect(perks.full_build.laborPercent).toBe(10);
  });

  test('fleet volume tiers pick the best reached tier', () => {
    const tiers = parseFleetTiers([{ min_trucks: 10, labor_percent: 10 }, { min_trucks: 3, labor_percent: 5 }, { min_trucks: 0, labor_percent: 5 }]);
    expect(tiers).toEqual([{ minTrucks: 3, laborPercent: 5 }, { minTrucks: 10, laborPercent: 10 }]);
    expect(fleetPercentFor(2, tiers)).toBe(0);
    expect(fleetPercentFor(4, tiers)).toBe(5);
    expect(fleetPercentFor(12, tiers)).toBe(10);
  });
});

describe('points', () => {
  test('capped by balance and remaining amount', () => {
    expect(pointsRedemption({ requested: 1000, balance: 400, pointValueCents: 5, remainingCents: 100_00 })).toEqual({ points: 400, cents: 20_00 });
    expect(pointsRedemption({ requested: 5000, balance: 9000, pointValueCents: 5, remainingCents: 10_00 })).toEqual({ points: 200, cents: 10_00 });
    expect(pointsRedemption({ requested: 10, balance: 10, pointValueCents: 5, remainingCents: 0 })).toEqual({ points: 0, cents: 0 });
    expect(pointsForCredit(50_00, 5)).toBe(1000);
  });
});

describe('codes and names', () => {
  test('single-use and partner codes', () => {
    expect(singleUseCode('fall-fuel10', () => 0)).toBe('FALLFUEL10-AAAAAA');
    expect(singleUseCode('fall', () => 0.999)).toMatch(/^FALL-[A-HJ-NP-Z2-9]{6}$/);
    expect(partnerCodeStem('Blue Water Boats & RV')).toBe('BLUEWATERB-REF');
    expect(partnerCodeStem('!')).toBe('PARTNER-REF');
  });

  test('leaderboard shows first name and last initial only', () => {
    expect(leaderboardName('Cody Marsh')).toBe('Cody M.');
    expect(leaderboardName('Mary Ann de la Cruz')).toBe('Mary C.');
    expect(leaderboardName('Prince')).toBe('Prince');
    expect(leaderboardName('  ')).toBe('Customer');
  });
});

describe('offer lint', () => {
  const base: OfferDraft = { kind: 'amount', value: 25_00, name: '$25 off fuel filters', description: null, terms: 'One per truck.', endsAt: '2026-12-01T00:00:00Z', minSpendCents: 0, maxRedemptions: null, bundleItems: [], bundlePriceCents: null, giftItem: null, creatorName: null };
  const rules = (o: Partial<OfferDraft>) => lintOffer({ ...base, ...o }).map((i) => `${i.severity}:${i.rule}`);

  test('clean offer passes', () => expect(rules({})).toEqual([]));
  test('terms required, expiry recommended', () => {
    expect(rules({ terms: ' ', endsAt: null })).toEqual(['block:terms_required', 'warn:no_expiry']);
  });
  test('starting-at and free need qualifiers', () => {
    expect(rules({ name: 'Tunes starting at $99', terms: 'One per customer.' })).toContain('warn:starting_at');
    expect(rules({ name: 'Starting at $99', terms: 'Price varies by truck.' })).not.toContain('warn:starting_at');
    expect(rules({ name: 'Free hat', giftItem: 'Hat', terms: 'One per truck.' })).toContain('warn:free_conditions');
    expect(rules({ name: 'Free hat', giftItem: 'Hat', terms: 'With any $300 purchase.' })).not.toContain('warn:free_conditions');
  });
  test('value vs min spend, bundles, creators, scarcity', () => {
    expect(rules({ minSpendCents: 20_00 })).toContain('block:value_vs_min_spend');
    expect(rules({ bundleItems: ['Lift pump'], bundlePriceCents: 900_00 })).toContain('block:bundle_items');
    expect(rules({ bundleItems: ['Lift pump', 'Install'], bundlePriceCents: 900_00, value: 0 })).toContain('block:bundle_price');
    expect(rules({ creatorName: 'DieselDan' })).toContain('warn:creator_disclosure');
    expect(rules({ creatorName: 'DieselDan', terms: 'Paid partner code.' })).not.toContain('warn:creator_disclosure');
    expect(rules({ name: 'Limited time deal', endsAt: null })).toContain('warn:bait_scarcity');
  });
});

describe('reports and schedules', () => {
  test('monthly partner statement', () => {
    const rows = monthlyStatement([
      { createdAt: '2026-08-10T15:00:00Z', status: 'rewarded', rewardCents: 25_00, rewardedAt: '2026-09-02T15:00:00Z' },
      { createdAt: '2026-09-05T15:00:00Z', status: 'pending', rewardCents: 0, rewardedAt: null },
      { createdAt: '2026-09-06T15:00:00Z', status: 'void', rewardCents: 0, rewardedAt: null },
    ]);
    expect(rows).toEqual([
      { month: '2026-09', referred: 1, rewarded: 1, owedCents: 25_00 },
      { month: '2026-08', referred: 1, rewarded: 0, owedCents: 0 },
    ]);
  });

  test('promo ROI', () => {
    expect(promoRoi([{ discountCents: 10_00, invoiceSubtotalCents: 200_00, invoiceCostCents: 90_00 }])).toEqual({ redemptions: 1, discountCents: 10_00, revenueCents: 190_00, marginCents: 100_00, roi: 10 });
    expect(promoRoi([]).roi).toBeNull();
  });

  test('expiring window', () => {
    const now = new Date('2026-09-17T12:00:00Z');
    expect(isExpiringSoon('2026-09-18T12:00:00Z', now)).toBe(true);
    expect(isExpiringSoon('2026-09-20T12:00:00Z', now)).toBe(false);
    expect(isExpiringSoon('2026-09-17T11:00:00Z', now)).toBe(false);
    expect(isExpiringSoon(null, now)).toBe(false);
  });

  test('referral asks after paid jobs or promoters, never unhappy customers', () => {
    const now = new Date('2026-09-17T12:00:00Z');
    const ago = (d: number) => new Date(now.getTime() - d * DAY).toISOString();
    const out = referralAskTargets({
      now,
      paid: [{ customerId: 'a', paidAt: ago(5) }, { customerId: 'b', paidAt: ago(1) }, { customerId: 'c', paidAt: ago(5) }, { customerId: 'd', paidAt: ago(40) }],
      nps: [{ customerId: 'c', score: 4, respondedAt: ago(2) }, { customerId: 'e', score: 10, respondedAt: ago(1) }],
    });
    expect(out).toEqual([
      { customerId: 'e', reason: 'promoter', discriminator: 'ask:2026h2' },
      { customerId: 'a', reason: 'paid_job', discriminator: 'ask:2026h2' },
    ]);
  });
});
