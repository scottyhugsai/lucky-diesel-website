import type { CampaignPlatform } from './types';

/**
 * Hard spend limits, checked before any ad is created or activated. Fails
 * closed: no guard, no end date or a missing budget all block publishing.
 */

export interface BudgetGuard {
  platform: CampaignPlatform | 'all';
  maxDailyCents: number;
  maxMonthlyCents: number;
  maxCampaignDays: number;
  autoPauseCplCents: number | null;
  pacingTolerance: number;
  active: boolean;
}

export interface CampaignBudgetPlan {
  platform: CampaignPlatform;
  dailyBudgetCents: number;
  /** YYYY-MM-DD */
  startsOn: string | null;
  endsOn: string | null;
}

export interface SpendSnapshot {
  /** Spend already recorded this calendar month for the guard's scope. */
  monthToDateCents: number;
  /** Daily budgets of other live campaigns counted by the shop-wide guard. */
  otherLiveDailyCents: number;
}

export type BudgetViolationCode = 'no_guard' | 'no_budget' | 'no_dates' | 'too_long' | 'daily_cap' | 'shop_daily_cap' | 'monthly_cap';

export interface BudgetCheck {
  ok: boolean;
  violations: { code: BudgetViolationCode; message: string }[];
}

const DAY_MS = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function toDay(date: string): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
}

/** Inclusive number of days between two YYYY-MM-DD dates. */
export function daysInclusive(start: string, end: string): number {
  return Math.floor((toDay(end) - toDay(start)) / DAY_MS) + 1;
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Days of the campaign that fall between `today` and the end of today's month, inclusive. */
export function remainingDaysThisMonth(plan: CampaignBudgetPlan, today: string): number {
  if (!plan.startsOn || !plan.endsOn) return 0;
  const monthEnd = isoDay(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0));
  const from = toDay(plan.startsOn) > toDay(today) ? plan.startsOn : today;
  const to = toDay(plan.endsOn) < toDay(monthEnd) ? plan.endsOn : monthEnd;
  return toDay(to) < toDay(from) ? 0 : daysInclusive(from, to);
}

export function checkBudget(plan: CampaignBudgetPlan, guards: readonly BudgetGuard[], spend: SpendSnapshot, today: string): BudgetCheck {
  const violations: BudgetCheck['violations'] = [];
  const platformGuard = guards.find((g) => g.active && g.platform === plan.platform);
  const shopGuard = guards.find((g) => g.active && g.platform === 'all');

  if (!platformGuard && !shopGuard) violations.push({ code: 'no_guard', message: `Set a budget guard for ${plan.platform} before publishing.` });
  if (!(plan.dailyBudgetCents > 0)) violations.push({ code: 'no_budget', message: 'A daily budget is required.' });
  if (!plan.startsOn || !plan.endsOn || !DATE.test(plan.startsOn) || !DATE.test(plan.endsOn) || toDay(plan.endsOn) < toDay(plan.startsOn)) {
    violations.push({ code: 'no_dates', message: 'Campaigns need a start and an end date; nothing runs open-ended.' });
  }
  if (violations.length) return { ok: false, violations };

  const duration = daysInclusive(plan.startsOn!, plan.endsOn!);
  const projectedMonth = spend.monthToDateCents + plan.dailyBudgetCents * remainingDaysThisMonth(plan, today);

  for (const guard of [platformGuard, shopGuard]) {
    if (!guard) continue;
    const scope = guard.platform === 'all' ? 'shop-wide' : guard.platform;
    if (duration > guard.maxCampaignDays) {
      violations.push({ code: 'too_long', message: `${duration} days exceeds the ${scope} limit of ${guard.maxCampaignDays} days.` });
    }
    if (guard.platform === 'all') {
      const combined = plan.dailyBudgetCents + spend.otherLiveDailyCents;
      if (combined > guard.maxDailyCents) {
        violations.push({ code: 'shop_daily_cap', message: `All live campaigns would spend ${dollars(combined)}/day; the shop cap is ${dollars(guard.maxDailyCents)}.` });
      }
    } else if (plan.dailyBudgetCents > guard.maxDailyCents) {
      violations.push({ code: 'daily_cap', message: `${dollars(plan.dailyBudgetCents)}/day is over the ${scope} cap of ${dollars(guard.maxDailyCents)}.` });
    }
    if (projectedMonth > guard.maxMonthlyCents) {
      violations.push({ code: 'monthly_cap', message: `Projected ${dollars(projectedMonth)} this month is over the ${scope} cap of ${dollars(guard.maxMonthlyCents)}.` });
    }
  }
  return { ok: violations.length === 0, violations };
}

export interface PacingInput {
  dailyBudgetCents: number;
  startsOn: string;
  endsOn: string;
  spentToDateCents: number;
  today: string;
  tolerance: number;
}

export interface PacingResult {
  elapsedDays: number;
  expectedCents: number;
  lifetimeBudgetCents: number;
  ratio: number;
  state: 'not_started' | 'under' | 'on_track' | 'over' | 'exhausted';
  shouldPause: boolean;
}

const UNDER_PACE = 0.5;

/** Compares spend to the straight-line budget. Over tolerance or over lifetime budget → pause. */
export function pacing(input: PacingInput): PacingResult {
  const duration = daysInclusive(input.startsOn, input.endsOn);
  const lifetimeBudgetCents = input.dailyBudgetCents * duration;
  const elapsedDays = Math.min(Math.max(daysInclusive(input.startsOn, input.today), 0), duration);
  const expectedCents = input.dailyBudgetCents * elapsedDays;

  if (elapsedDays === 0) {
    return { elapsedDays, expectedCents, lifetimeBudgetCents, ratio: 0, state: 'not_started', shouldPause: input.spentToDateCents > 0 };
  }
  const ratio = expectedCents > 0 ? input.spentToDateCents / expectedCents : 0;
  if (input.spentToDateCents >= lifetimeBudgetCents) {
    return { elapsedDays, expectedCents, lifetimeBudgetCents, ratio, state: 'exhausted', shouldPause: true };
  }
  const state = ratio > input.tolerance ? 'over' : ratio < UNDER_PACE && elapsedDays > 1 ? 'under' : 'on_track';
  return { elapsedDays, expectedCents, lifetimeBudgetCents, ratio, state, shouldPause: state === 'over' };
}

/** Pause when cost per lead stays above the cap once enough money has been spent to judge. */
export function shouldPauseForCpl(spendCents: number, leads: number, capCents: number | null, minSpendCents = 5000): boolean {
  if (!capCents || spendCents < minSpendCents) return false;
  return leads === 0 ? spendCents >= capCents : spendCents / leads > capCents;
}
