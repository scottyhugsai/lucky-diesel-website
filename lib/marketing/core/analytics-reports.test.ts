import { describe, expect, test } from 'vitest';
import type { DayStat } from './analytics-math';
import {
  budgetVsActual, buildDigest, callAttribution, cohortGrid, detectAnomalies, firstResponseAt, goalProgress, ltvBySource,
  median, monthElapsed, reminderConversion, retentionReport, speedToLead, weekStartOf,
} from './analytics-reports';

const inv = (customer_id: string, paid_at: string, total_cents = 10_000) => ({ customer_id, paid_at, total_cents });

describe('ltvBySource', () => {
  test('revenue per paying customer and repeat rate by first-touch source', () => {
    const rows = ltvBySource(
      [{ id: 'a', source: 'google' }, { id: 'b', source: 'google' }, { id: 'c', source: 'referral' }],
      [inv('a', '2026-01-01', 50_000), inv('a', '2026-05-01', 30_000), inv('c', '2026-02-01', 200_000)],
    );
    expect(rows[0]).toMatchObject({ source: 'referral', paying: 1, ltvCents: 200_000, repeatRate: 0 });
    expect(rows[1]).toMatchObject({ source: 'google', customers: 2, paying: 1, revenueCents: 80_000, ltvCents: 80_000, repeatRate: 1 });
  });
});

describe('speed to lead', () => {
  const lead = { created_at: '2026-09-01T12:00:00Z', contacted_at: null, phone: '(843) 555-0101', email: 'Sam@Example.com' };

  test('firstResponseAt matches phone digits or email, ignoring earlier messages', () => {
    expect(firstResponseAt(lead, [
      { to_address: '+18435550101', created_at: '2026-09-01T11:00:00Z' },
      { to_address: 'sam@example.com', created_at: '2026-09-01T12:30:00Z' },
      { to_address: '+18435550101', created_at: '2026-09-01T12:04:00Z' },
      { to_address: '+18435559999', created_at: '2026-09-01T12:01:00Z' },
    ])).toBe('2026-09-01T12:04:00.000Z');
    expect(firstResponseAt({ ...lead, contacted_at: '2026-09-01T12:02:00Z' }, [])).toBe('2026-09-01T12:02:00.000Z');
  });

  test('buckets, median and booking rate by response time', () => {
    const report = speedToLead([
      { created_at: '2026-09-01T12:00:00Z', first_response_at: '2026-09-01T12:03:00Z', booked: true },
      { created_at: '2026-09-01T12:00:00Z', first_response_at: '2026-09-01T12:30:00Z', booked: false },
      { created_at: '2026-09-01T12:00:00Z', first_response_at: '2026-09-02T14:00:00Z', booked: false },
      { created_at: '2026-09-01T12:00:00Z', first_response_at: null, booked: false },
    ]);
    expect(report).toMatchObject({ leads: 4, responded: 3, medianMinutes: 30, within5Rate: 0.25 });
    expect(report.buckets.map((b) => b.leads)).toEqual([1, 1, 0, 1, 1]);
    expect(report.buckets[0]!.bookingRate).toBe(1);
  });

  test('median of even and empty lists', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('retention and cohorts', () => {
  const now = new Date('2026-09-15T12:00:00Z');

  test('returning rate, days between visits, 12-month retention and lapsed', () => {
    const report = retentionReport([
      inv('a', '2025-03-01T12:00:00Z'), inv('a', '2026-03-01T12:00:00Z'),
      inv('b', '2025-06-01T12:00:00Z'),
      inv('c', '2026-08-01T12:00:00Z'), inv('c', '2026-08-31T12:00:00Z'),
    ], now);
    expect(report).toMatchObject({ customers: 3, returning: 2, returningRate: 0.667, medianDaysBetween: 198, retained12mRate: 0.5, lapsed: 1 });
  });

  test('cohortGrid tracks later visits and leaves future months null', () => {
    const rows = cohortGrid([inv('a', '2026-07-05T12:00:00Z'), inv('a', '2026-09-01T12:00:00Z'), inv('b', '2026-07-20T12:00:00Z'), inv('old', '2025-01-01T12:00:00Z')], now, 3);
    expect(rows.map((r) => r.cohort)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(rows[0]).toEqual({ cohort: '2026-07', size: 2, cells: [1, 0, 0.5] });
    expect(rows[1]!.cells).toEqual([0, 0, null]);
    expect(rows[2]!.cells).toEqual([0, null, null]);
  });

  test('reminderConversion counts bookings inside the window', () => {
    expect(reminderConversion(
      [{ customer_id: 'a', created_at: '2026-08-01T00:00:00Z' }, { customer_id: 'b', created_at: '2026-08-01T00:00:00Z' }, { customer_id: null, created_at: '2026-08-01T00:00:00Z' }],
      [{ customer_id: 'a', created_at: '2026-08-10T00:00:00Z' }, { customer_id: 'b', created_at: '2026-10-10T00:00:00Z' }],
    )).toEqual({ sent: 2, booked: 1, rate: 0.5 });
  });
});

const day = (i: number, leads: number, spendCents = 0, bookings = 0): DayStat => ({
  date: new Date(Date.UTC(2026, 7, 1) + i * 86_400_000).toISOString().slice(0, 10), leads, bookings, paidJobs: 0, revenueCents: 0, spendCents,
});

describe('anomalies', () => {
  test('flags a lead drop and a spend spike against the 4-week baseline', () => {
    const days = [...Array.from({ length: 28 }, (_, i) => day(i, 2, 2_000, 1)), ...Array.from({ length: 7 }, (_, i) => day(28 + i, 0, 6_000, 1))];
    const found = detectAnomalies(days);
    expect(found.map((a) => `${a.metric}:${a.direction}`)).toEqual(['leads:down', 'spend:up']);
    expect(found[0]).toMatchObject({ current: 0, baseline: 14, changeRatio: -1 });
    expect(found[0]!.dedupeKey).toBe(`leads:down:${weekStartOf(days[34]!.date)}`);
  });

  test('stays quiet on low volume or short history', () => {
    expect(detectAnomalies(Array.from({ length: 35 }, (_, i) => day(i, i < 28 ? 0 : 1)))).toEqual([]);
    expect(detectAnomalies(Array.from({ length: 20 }, (_, i) => day(i, 5)))).toEqual([]);
  });

  test('cost per lead rise is flagged, a fall is not', () => {
    const rising = [...Array.from({ length: 28 }, (_, i) => day(i, 1, 3_000)), ...Array.from({ length: 7 }, (_, i) => day(28 + i, i < 3 ? 1 : 0, 3_000))];
    expect(detectAnomalies(rising).map((a) => a.metric)).toContain('cpl');
  });

  test('weekStartOf returns Monday', () => {
    expect(weekStartOf('2026-09-17')).toBe('2026-09-14');
    expect(weekStartOf('2026-09-14')).toBe('2026-09-14');
    expect(weekStartOf('2026-09-13')).toBe('2026-09-07');
  });
});

describe('digest, goals, budgets, calls', () => {
  test('buildDigest compares weeks in short lines', () => {
    const digest = buildDigest({ weekStart: '2026-09-07', current: { leads: 12, bookings: 5, revenueCents: 480_000, spendCents: 60_000 }, previous: { leads: 10, bookings: 5, revenueCents: 0, spendCents: 0 }, topSource: 'Google', openAlerts: 1, goalLine: null });
    expect(digest.headline).toBe('Week of 2026-09-07: 12 leads, 5 booked');
    expect(digest.lines).toEqual(['Leads: 12 (+20%)', 'Booked: 5 (flat)', 'Revenue: $4,800 (new)', 'Ad spend: $600 · cost per lead $50', 'Top source: Google', '1 alert needs a look']);
  });

  test('goalProgress paces against the elapsed month', () => {
    const rows = goalProgress([{ metric: 'leads', target: 40 }, { metric: 'max_cpl', target: 5_000 }, { metric: 'revenue', target: 0 }], { leads: 10, bookings: 0, revenueCents: 0, costPerLeadCents: 6_000 }, 0.5);
    expect(rows).toEqual([
      { metric: 'leads', label: 'Leads', target: 40, actual: 10, ratio: 0.25, onPace: false },
      { metric: 'max_cpl', label: 'Max cost / lead', target: 5_000, actual: 6_000, ratio: 1.2, onPace: false },
    ]);
    expect(monthElapsed(new Date('2026-09-15T16:00:00Z'))).toBe(0.5);
  });

  test('budgetVsActual joins ad spend and manual spend with pace', () => {
    const { rows, total } = budgetVsActual(
      [{ channel: 'google', budget_cents: 100_000, manual_spend_cents: 0 }, { channel: 'print', budget_cents: 20_000, manual_spend_cents: 15_000 }],
      [{ source: 'google', spend_cents: 40_000 }, { source: 'facebook', spend_cents: 5_000 }],
      0.5,
    );
    expect(rows.map((r) => [r.channel, r.actualCents, r.pace])).toEqual([['google', 40_000, 0.8], ['facebook', 5_000, null], ['print', 15_000, 1.5]]);
    expect(total).toMatchObject({ budgetCents: 120_000, actualCents: 60_000, pace: 1 });
  });

  test('callAttribution maps tracking numbers to sources', () => {
    const rows = callAttribution(
      [
        { to_number: '+18435550001', call_status: 'no-answer', customer_id: 'x', texted_back_at: 'now' },
        { to_number: '(843) 555-0001', call_status: 'busy', customer_id: null, texted_back_at: null },
        { to_number: '+18435559999', call_status: 'no-answer', customer_id: null, texted_back_at: null },
      ],
      [{ phone: '+18435550001', source: 'google', label: 'Google Ads' }],
    );
    expect(rows).toEqual([
      { source: 'google', label: 'Google Ads', calls: 2, missed: 2, textedBack: 1, knownCustomers: 1 },
      { source: 'untracked', label: 'Main line', calls: 1, missed: 1, textedBack: 0, knownCustomers: 0 },
    ]);
  });
});
