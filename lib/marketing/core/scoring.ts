/** Pure lead scoring, lifecycle stage and mileage prediction. */

import type { LoyaltyTier } from './segment-rules';

const DAY_MS = 86_400_000;
const DAYS_PER_MONTH = 30.44;

export interface LeadScoreInput {
  serviceId: string | null;
  platform: string | null;
  source: string;
  status: string;
  smsConsent: boolean;
  detailsLength: number;
  createdAt: Date;
  now: Date;
}

const HIGH_VALUE_SERVICES = new Set(['tuning', 'turbo', 'fuel', 'engine', 'injectors']);
const MID_VALUE_SERVICES = new Set(['transmission', 'exhaust']);
const SOURCE_POINTS: Record<string, number> = { referral: 20, 'online booking': 20, google: 15, instagram: 10, facebook: 10, tiktok: 10, website: 10 };

/** 0–100 rule-based score. Open leads sort by it; won/lost are pinned to 100/0. */
export function scoreLead(input: LeadScoreInput): number {
  if (input.status === 'won' || input.status === 'booked') return 100;
  if (input.status === 'lost') return 0;
  let score = 0;
  const service = input.serviceId ?? '';
  score += HIGH_VALUE_SERVICES.has(service) ? 25 : MID_VALUE_SERVICES.has(service) ? 15 : 10;
  if (input.platform && input.platform !== 'other') score += 10;
  score += SOURCE_POINTS[input.source.toLowerCase()] ?? 5;
  const ageDays = (input.now.getTime() - input.createdAt.getTime()) / DAY_MS;
  score += ageDays < 1 ? 20 : ageDays < 3 ? 10 : ageDays < 7 ? 5 : 0;
  if (input.smsConsent) score += 10;
  if (input.detailsLength >= 40) score += 10;
  if (input.status === 'contacted') score += 5;
  return Math.max(0, Math.min(100, score));
}

export type LifecycleStage = 'subscriber' | 'lead' | 'customer' | 'repeat' | 'vip' | 'lapsed' | 'lost';

export interface StageInput {
  paidVisits: number;
  lastPaidAt: Date | null;
  lifetimeSpendCents: number;
  tier: LoyaltyTier;
  openLeads: number;
  lostLeads: number;
  now: Date;
}

export const LAPSED_AFTER_DAYS = 365;

export function lifecycleStageFor(input: StageInput): LifecycleStage {
  if (input.paidVisits === 0) {
    if (input.openLeads > 0) return 'lead';
    return input.lostLeads > 0 ? 'lost' : 'subscriber';
  }
  if (input.lastPaidAt && input.now.getTime() - input.lastPaidAt.getTime() > LAPSED_AFTER_DAYS * DAY_MS) return 'lapsed';
  if (input.tier === 'stage_2' || input.tier === 'full_build') return 'vip';
  return input.paidVisits >= 2 ? 'repeat' : 'customer';
}

export interface MileageReading {
  at: Date;
  miles: number;
}

const MIN_SPAN_DAYS = 30;
const MIN_RATE = 100;
const MAX_RATE = 6000;
export const DEFAULT_MILES_PER_MONTH = 1000;

/** Miles per month from the earliest and latest odometer readings, or null without enough history. */
export function estimateMilesPerMonth(readings: readonly MileageReading[]): number | null {
  const valid = readings.filter((r) => Number.isFinite(r.miles) && r.miles > 0).sort((a, b) => a.at.getTime() - b.at.getTime());
  if (valid.length < 2) return null;
  const first = valid[0]!;
  const last = valid[valid.length - 1]!;
  const days = (last.at.getTime() - first.at.getTime()) / DAY_MS;
  const miles = last.miles - first.miles;
  if (days < MIN_SPAN_DAYS || miles <= 0) return null;
  return Math.max(MIN_RATE, Math.min(MAX_RATE, Math.round((miles / days) * DAYS_PER_MONTH)));
}

/** Odometer today: latest reading plus the estimated rate since it was taken. */
export function predictMileage(readings: readonly MileageReading[], now: Date, fallbackRate = DEFAULT_MILES_PER_MONTH): number | null {
  const valid = readings.filter((r) => Number.isFinite(r.miles) && r.miles > 0);
  if (!valid.length) return null;
  const latest = valid.reduce((a, b) => (b.at.getTime() > a.at.getTime() || (b.at.getTime() === a.at.getTime() && b.miles > a.miles) ? b : a));
  const rate = estimateMilesPerMonth(valid) ?? fallbackRate;
  const months = Math.max(0, (now.getTime() - latest.at.getTime()) / DAY_MS / DAYS_PER_MONTH);
  return Math.round(latest.miles + rate * months);
}

export const OIL_SERVICE_MILES = 7500;
export const SERVICE_DUE_BUFFER_MILES = 500;

/** Due when predicted miles since the last service reach the interval minus the buffer. */
export function isServiceDue(predictedMiles: number | null, lastServiceMiles: number | null, interval = OIL_SERVICE_MILES, buffer = SERVICE_DUE_BUFFER_MILES): boolean {
  if (predictedMiles === null || lastServiceMiles === null) return false;
  return predictedMiles - lastServiceMiles >= interval - buffer;
}

/** Overdue at this multiple of a customer's usual gap between visits. */
export const CHURN_RISK_RATIO = 1.5;
const MIN_INTERVAL_DAYS = 14;

export interface VisitRhythm {
  /** Median days between paid visits, or null with fewer than two visits. */
  medianIntervalDays: number | null;
  /** Days since the last visit divided by the median interval (e.g. 1.8 = 80% overdue). */
  overdueRatio: number | null;
  atRisk: boolean;
}

/**
 * Per-customer churn signal: compares time since the last paid visit with that
 * customer's own usual interval. Visits on the same day count once; gaps under
 * two weeks (follow-up jobs) are ignored.
 */
export function visitRhythm(visits: readonly Date[], now: Date, riskRatio = CHURN_RISK_RATIO): VisitRhythm {
  const days = [...new Set(visits.filter((d) => Number.isFinite(d.getTime()) && d.getTime() <= now.getTime()).map((d) => Math.floor(d.getTime() / DAY_MS)))].sort((a, b) => a - b);
  const gaps = days.slice(1).map((day, i) => day - days[i]!).filter((gap) => gap >= MIN_INTERVAL_DAYS).sort((a, b) => a - b);
  if (!gaps.length) return { medianIntervalDays: null, overdueRatio: null, atRisk: false };
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[mid]! : (gaps[mid - 1]! + gaps[mid]!) / 2;
  const since = Math.floor(now.getTime() / DAY_MS) - days[days.length - 1]!;
  const ratio = Math.round((since / median) * 100) / 100;
  return { medianIntervalDays: Math.round(median), overdueRatio: ratio, atRisk: ratio >= riskRatio };
}
