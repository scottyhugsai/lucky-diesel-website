import { describe, expect, test } from 'vitest';
import { discountFor, isTierUpgrade, parseTierThresholds, pointsForPayment, qualifyingInvoice, referralCode, tierForSpend, validateRedemption, type OfferLike } from './rewards';

describe('referral codes', () => {
  test('name stem plus unambiguous suffix', () => {
    let i = 0;
    const code = referralCode('Cody Brooks', () => [0, 0.5, 0.99, 0.2][i++ % 4]!);
    expect(code).toMatch(/^CODY-[A-HJ-NP-Z2-9]{4}$/);
    expect(referralCode("D'Andre", () => 0)).toBe('DANDRE-AAAA');
    expect(referralCode('李', () => 0)).toBe('FRIEND-AAAA');
  });
});

describe('VIP tiers', () => {
  test('by lifetime spend', () => {
    expect(tierForSpend(0)).toBe('stock');
    expect(tierForSpend(99_999)).toBe('stock');
    expect(tierForSpend(100_000)).toBe('stage_1');
    expect(tierForSpend(500_000)).toBe('stage_2');
    expect(tierForSpend(2_000_000)).toBe('full_build');
  });

  test('custom thresholds and upgrade detection', () => {
    const thresholds = parseTierThresholds({ stage_1: 10, stage_2: 'bad', full_build: 30 });
    expect(thresholds).toEqual({ stage_1: 10, stage_2: 500_000, full_build: 30 });
    expect(isTierUpgrade('stock', 'stage_2')).toBe(true);
    expect(isTierUpgrade('full_build', 'stage_1')).toBe(false);
  });

  test('points are whole dollars times the rate', () => {
    expect(pointsForPayment(154_999, 1)).toBe(1549);
    expect(pointsForPayment(99, 2)).toBe(0);
    expect(pointsForPayment(10_000, 0)).toBe(0);
  });
});

describe('offers', () => {
  const offer: OfferLike = { kind: 'percent', value: 10, active: true, starts_at: '2026-09-01T00:00:00Z', ends_at: '2026-10-01T00:00:00Z', max_redemptions: 50, per_customer_limit: 1, min_spend_cents: 20_000, segment_id: null };
  const ctx = { now: new Date('2026-09-17T12:00:00Z'), subtotalCents: 50_000, totalRedemptions: 3, customerRedemptions: 0, inSegment: false };

  test('computes discounts without going below zero', () => {
    expect(discountFor({ kind: 'percent', value: 10 }, 50_000)).toBe(5_000);
    expect(discountFor({ kind: 'amount', value: 7_500 }, 5_000)).toBe(5_000);
    expect(discountFor({ kind: 'free_service', value: 12_900 }, 60_000)).toBe(12_900);
  });

  test('valid redemption returns the discount', () => {
    expect(validateRedemption(offer, ctx)).toEqual({ ok: true, discountCents: 5_000 });
  });

  test.each([
    [{ active: false }, {}, 'no longer active'],
    [{}, { now: new Date('2026-08-01T00:00:00Z') }, 'hasn’t started'],
    [{}, { now: new Date('2026-10-01T00:00:00Z') }, 'expired'],
    [{}, { totalRedemptions: 50 }, 'fully redeemed'],
    [{}, { customerRedemptions: 1 }, 'maximum number'],
    [{}, { subtotalCents: 19_999 }, 'minimum spend'],
    [{ segment_id: 'seg' }, { inSegment: false }, 'isn’t available'],
  ])('rejects (%#)', (offerPatch, ctxPatch, reason) => {
    const result = validateRedemption({ ...offer, ...offerPatch }, { ...ctx, ...ctxPatch });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain(reason);
  });
});

describe('referral rewards', () => {
  const invoices = [
    { id: 'old', customer_id: 'friend', status: 'paid', paid_at: '2026-08-01T12:00:00Z' },
    { id: 'first', customer_id: 'friend', status: 'paid', paid_at: '2026-09-05T12:00:00Z' },
    { id: 'second', customer_id: 'friend', status: 'paid', paid_at: '2026-09-10T12:00:00Z' },
    { id: 'open', customer_id: 'friend', status: 'open', paid_at: null },
  ];

  test('first paid invoice after the referral qualifies', () => {
    expect(qualifyingInvoice({ status: 'pending', referred_customer_id: 'friend', created_at: '2026-09-01T00:00:00Z' }, invoices)?.id).toBe('first');
  });

  test('nothing for rewarded/void referrals or unpaid friends', () => {
    expect(qualifyingInvoice({ status: 'rewarded', referred_customer_id: 'friend', created_at: '2026-09-01T00:00:00Z' }, invoices)).toBeNull();
    expect(qualifyingInvoice({ status: 'pending', referred_customer_id: 'nobody', created_at: '2026-09-01T00:00:00Z' }, invoices)).toBeNull();
    expect(qualifyingInvoice({ status: 'pending', referred_customer_id: 'friend', created_at: '2026-09-11T00:00:00Z' }, invoices)).toBeNull();
  });
});
