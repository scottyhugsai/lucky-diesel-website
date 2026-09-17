import { describe, expect, test } from 'vitest';
import { campaignReport, funnelTotals, rollupFunnel, type ConversionRow } from './analytics-math';

const conv = (kind: ConversionRow['kind'], source: string, value = 0, first: string | null = null): ConversionRow => ({ kind, source, first_source: first, value_cents: value });

describe('rollupFunnel', () => {
  const rows: ConversionRow[] = [
    conv('lead', 'google', 0, 'instagram'), conv('lead', 'google'), conv('lead', 'google'), conv('lead', 'instagram'),
    conv('booking', 'google', 0, 'instagram'), conv('booking', 'google'),
    conv('job_paid', 'google', 250_000, 'instagram'), conv('job_paid', 'referral', 90_000),
    conv('store_checkout_click', 'tiktok'),
  ];

  test('counts each stage and revenue per last-touch source, with CPL and ROAS from spend', () => {
    const result = rollupFunnel(rows, [{ source: 'google', spend_cents: 60_000 }]);
    const google = result.find((r) => r.source === 'google')!;
    expect(google).toMatchObject({ leads: 3, bookings: 2, paidJobs: 1, revenueCents: 250_000, spendCents: 60_000, costPerLeadCents: 20_000, costPerBookingCents: 30_000, roas: 4.17 });
    expect(google.leadToBookingRate).toBe(0.667);
    expect(google.bookingToPaidRate).toBe(0.5);
    expect(result[0]!.source).toBe('google');
    expect(result.find((r) => r.source === 'tiktok')?.checkoutClicks).toBe(1);
  });

  test('without spend, CPL and ROAS are null rather than zero', () => {
    const referral = rollupFunnel(rows, []).find((r) => r.source === 'referral')!;
    expect(referral.costPerLeadCents).toBeNull();
    expect(referral.roas).toBeNull();
  });

  test('first-touch model credits the first source', () => {
    const instagram = rollupFunnel(rows, [], 'first').find((r) => r.source === 'instagram')!;
    expect(instagram).toMatchObject({ leads: 2, bookings: 1, paidJobs: 1, revenueCents: 250_000 });
  });

  test('spend with no conversions still shows up', () => {
    const result = rollupFunnel([], [{ source: 'facebook', spend_cents: 10_000 }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ source: 'facebook', spendCents: 10_000, roas: 0, costPerLeadCents: null });
  });

  test('totals add up', () => {
    const totals = funnelTotals(rollupFunnel(rows, [{ source: 'google', spend_cents: 60_000 }]));
    expect(totals).toMatchObject({ source: 'total', leads: 4, bookings: 2, paidJobs: 2, revenueCents: 340_000, spendCents: 60_000, costPerLeadCents: 15_000 });
  });
});

describe('campaignReport', () => {
  test('per-variant delivery and engagement', () => {
    const report = campaignReport([
      { variant: 'A', status: 'simulated', opened_at: 'x', clicked_at: 'x', converted_at: 'x', revenue_cents: 50_000 },
      { variant: 'A', status: 'sent', opened_at: null, clicked_at: null, converted_at: null, revenue_cents: 0 },
      { variant: 'B', status: 'skipped', opened_at: null, clicked_at: null, converted_at: null, revenue_cents: 0 },
      { variant: null, status: 'scheduled', opened_at: null, clicked_at: null, converted_at: null, revenue_cents: 0 },
    ]);
    expect(report.map((r) => r.variant)).toEqual(['A', 'B', 'pending']);
    expect(report[0]).toMatchObject({ delivered: 2, clicked: 1, converted: 1, revenueCents: 50_000, clickRate: 0.5 });
    expect(report[1]).toMatchObject({ skipped: 1, clickRate: null });
  });
});
