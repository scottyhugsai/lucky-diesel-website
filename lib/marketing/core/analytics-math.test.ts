import { describe, expect, test } from 'vitest';
import { campaignReport, dailySeries, funnelTotals, grossProfitCents, parseAttributionModel, rollupFunnel, touchCredits, type ConversionRow } from './analytics-math';

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

describe('multi-touch models', () => {
  const touches = [
    { source: 'google', at: '2026-09-01T12:00:00Z' },
    { source: 'instagram', at: '2026-09-08T12:00:00Z' },
    { source: 'email', at: '2026-09-15T12:00:00Z' },
  ];
  const credit = (model: Parameters<typeof touchCredits>[1]) => Object.fromEntries(touchCredits(touches, model, '2026-09-15T12:00:00Z'));

  test('first, last and linear', () => {
    expect(credit('first')).toEqual({ google: 1 });
    expect(credit('last')).toEqual({ email: 1 });
    const linear = credit('linear');
    expect(linear.google).toBeCloseTo(1 / 3);
    expect(linear.email).toBeCloseTo(1 / 3);
  });

  test('position gives 40/20/40 and 50/50 with two touches', () => {
    expect(credit('position')).toEqual({ google: 0.4, instagram: 0.2, email: 0.4 });
    expect(Object.fromEntries(touchCredits(touches.slice(0, 2), 'position'))).toEqual({ google: 0.5, instagram: 0.5 });
  });

  test('time decay halves credit per week and sums to 1', () => {
    const decay = credit('time_decay');
    expect(decay.email! / decay.instagram!).toBeCloseTo(2);
    expect(decay.instagram! / decay.google!).toBeCloseTo(2);
    expect(decay.google! + decay.instagram! + decay.email!).toBeCloseTo(1);
  });

  test('rollup splits revenue and profit fractionally', () => {
    const rows = rollupFunnel([{ kind: 'job_paid', source: 'email', first_source: 'google', value_cents: 100_000, profit_cents: 40_000, touches, occurred_at: '2026-09-15T12:00:00Z' }], [{ source: 'google', spend_cents: 10_000 }], 'position');
    const google = rows.find((r) => r.source === 'google')!;
    expect(google).toMatchObject({ paidJobs: 0.4, revenueCents: 40_000, profitCents: 16_000, roas: 4, profitRoas: 1.6 });
  });

  test('without touch history multi-touch falls back to stored first and last', () => {
    const rows = rollupFunnel([conv('lead', 'google', 0, 'instagram')], [], 'linear');
    expect(rows.map((r) => [r.source, r.leads])).toEqual([['google', 0.5], ['instagram', 0.5]]);
  });

  test('parseAttributionModel defaults to last', () => {
    expect(parseAttributionModel('time_decay')).toBe('time_decay');
    expect(parseAttributionModel('bogus')).toBe('last');
  });
});

describe('gross profit and daily series', () => {
  test('grossProfitCents skips declined lines and treats missing cost as margin', () => {
    expect(grossProfitCents([
      { quantity: 1, unit_price_cents: 279_500, unit_cost_cents: 220_000, approval: 'approved' },
      { quantity: '2.5', unit_price_cents: 16_000, unit_cost_cents: null, approval: 'approved' },
      { quantity: 1, unit_price_cents: 50_000, unit_cost_cents: 10_000, approval: 'declined' },
    ])).toBe(59_500 + 40_000);
  });

  test('dailySeries zero-fills and buckets by shop day', () => {
    const days = dailySeries(
      [{ kind: 'lead', value_cents: 0, occurred_at: '2026-09-02T02:00:00Z' }, { kind: 'job_paid', value_cents: 5_000, occurred_at: '2026-09-02T15:00:00Z' }],
      [{ date: '2026-09-03', spend_cents: 700 }],
      new Date('2026-09-01T16:00:00Z'), new Date('2026-09-03T16:00:00Z'),
    );
    expect(days.map((d) => d.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    expect(days[0]!.leads).toBe(1); // 10pm Eastern on Sep 1
    expect(days[1]).toMatchObject({ paidJobs: 1, revenueCents: 5_000 });
    expect(days[2]!.spendCents).toBe(700);
  });
});

describe('startOfDayInZone', () => {
  test('midnight Eastern in summer and winter', async () => {
    const { startOfDayInZone } = await import('./analytics-math');
    expect(startOfDayInZone('2026-09-01').toISOString()).toBe('2026-09-01T04:00:00.000Z');
    expect(startOfDayInZone('2026-01-01').toISOString()).toBe('2026-01-01T05:00:00.000Z');
  });
});
