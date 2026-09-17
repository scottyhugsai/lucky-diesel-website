import { describe, expect, test } from 'vitest';
import { checkBudget, pacing, remainingDaysThisMonth, shouldPauseForCpl, type BudgetGuard } from './budget';

const guards: BudgetGuard[] = [
  { platform: 'meta', maxDailyCents: 5000, maxMonthlyCents: 60000, maxCampaignDays: 30, autoPauseCplCents: 4500, pacingTolerance: 1.2, active: true },
  { platform: 'all', maxDailyCents: 8000, maxMonthlyCents: 150000, maxCampaignDays: 45, autoPauseCplCents: null, pacingTolerance: 1.2, active: true },
];
const plan = { platform: 'meta' as const, dailyBudgetCents: 2500, startsOn: '2026-09-20', endsOn: '2026-10-03' };
const noSpend = { monthToDateCents: 0, otherLiveDailyCents: 0 };

describe('checkBudget', () => {
  test('passes a campaign inside every cap', () => {
    expect(checkBudget(plan, guards, noSpend, '2026-09-17')).toEqual({ ok: true, violations: [] });
  });

  test('fails closed without a guard, a budget or dates', () => {
    expect(checkBudget({ ...plan, platform: 'tiktok' }, guards.slice(0, 1), noSpend, '2026-09-17').violations.map((v) => v.code)).toEqual(['no_guard']);
    expect(checkBudget({ ...plan, dailyBudgetCents: 0 }, guards, noSpend, '2026-09-17').ok).toBe(false);
    expect(checkBudget({ ...plan, endsOn: null }, guards, noSpend, '2026-09-17').violations[0]!.code).toBe('no_dates');
    expect(checkBudget({ ...plan, endsOn: '2026-09-01' }, guards, noSpend, '2026-09-17').violations[0]!.code).toBe('no_dates');
  });

  test('enforces platform daily, shop-wide daily, duration and monthly caps', () => {
    const codes = (p: typeof plan, spend = noSpend) => checkBudget(p, guards, spend, '2026-09-17').violations.map((v) => v.code);
    expect(codes({ ...plan, dailyBudgetCents: 6000 })).toContain('daily_cap');
    expect(codes(plan, { monthToDateCents: 0, otherLiveDailyCents: 6000 })).toContain('shop_daily_cap');
    expect(codes({ ...plan, endsOn: '2026-11-30' })).toContain('too_long');
    expect(codes(plan, { monthToDateCents: 55000, otherLiveDailyCents: 0 })).toContain('monthly_cap');
  });

  test('projects only the days left in this month', () => {
    expect(remainingDaysThisMonth(plan, '2026-09-17')).toBe(11);
    expect(remainingDaysThisMonth(plan, '2026-10-02')).toBe(2);
  });
});

describe('pacing', () => {
  const base = { dailyBudgetCents: 2000, startsOn: '2026-09-01', endsOn: '2026-09-10', tolerance: 1.2 };
  test('on track, under, over and exhausted', () => {
    expect(pacing({ ...base, spentToDateCents: 10000, today: '2026-09-05' }).state).toBe('on_track');
    expect(pacing({ ...base, spentToDateCents: 2000, today: '2026-09-05' }).state).toBe('under');
    const over = pacing({ ...base, spentToDateCents: 13000, today: '2026-09-05' });
    expect(over.state).toBe('over');
    expect(over.shouldPause).toBe(true);
    expect(pacing({ ...base, spentToDateCents: 20000, today: '2026-09-09' })).toMatchObject({ state: 'exhausted', shouldPause: true });
  });
  test('any spend before the start date pauses', () => {
    expect(pacing({ ...base, spentToDateCents: 1, today: '2026-08-30' })).toMatchObject({ state: 'not_started', shouldPause: true });
  });
  test('cost-per-lead auto-pause waits for enough spend', () => {
    expect(shouldPauseForCpl(3000, 0, 4500)).toBe(false);
    expect(shouldPauseForCpl(9000, 1, 4500)).toBe(true);
    expect(shouldPauseForCpl(9000, 3, 4500)).toBe(false);
    expect(shouldPauseForCpl(9000, 3, null)).toBe(false);
  });
});
