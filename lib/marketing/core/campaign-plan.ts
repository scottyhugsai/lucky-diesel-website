/** Pure campaign scheduling rules: A/B assignment, winners, idempotency keys, drip timing and exits. */

import { intersectWindows, localClock, nextSendTime, quietHoursWindow, type SendWindow } from './policy';

const MINUTE_MS = 60_000;

export type ExitReason = 'booked' | 'replied' | 'unsubscribed';
export const EXIT_REASONS: readonly ExitReason[] = ['booked', 'replied', 'unsubscribed'];

/** One row per campaign/step/customer. Re-running a materializer can never double-send. */
export function sendDedupeKey(campaignId: string, stepOrder: number, customerId: string): string {
  return `campaign:${campaignId}:step:${stepOrder}:customer:${customerId}`;
}

/** FNV-1a 32-bit. Stable across runs and runtimes. */
export function stableBucket(input: string, buckets = 100): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % buckets;
}

/**
 * Variant for a recipient. With an A/B test, `testPercent` of the audience is
 * split evenly across variants; everyone else gets `null` and waits for the
 * winner. Without variants (or 0%), everyone gets the first variant.
 */
export function assignVariant(campaignId: string, customerId: string, variants: readonly string[], testPercent: number): string | null {
  const sorted = [...new Set(variants)].sort();
  if (sorted.length === 0) return 'A';
  if (sorted.length === 1 || testPercent <= 0) return sorted[0]!;
  const bucket = stableBucket(`${campaignId}:${customerId}`);
  if (bucket >= Math.min(100, testPercent)) return null;
  return sorted[stableBucket(`${customerId}:${campaignId}:variant`, sorted.length)]!;
}

export interface VariantStats {
  variant: string;
  sent: number;
  clicks: number;
  bookings: number;
}

/** Highest click (or booking) rate wins; ties and empty tests fall back to the alphabetically first variant. */
export function pickWinner(stats: readonly VariantStats[], metric: 'click' | 'booking'): string {
  const ranked = [...stats]
    .filter((s) => s.sent > 0)
    .map((s) => ({ variant: s.variant, rate: (metric === 'click' ? s.clicks : s.bookings) / s.sent }))
    .sort((a, b) => b.rate - a.rate || a.variant.localeCompare(b.variant));
  if (ranked.length) return ranked[0]!.variant;
  return [...stats.map((s) => s.variant)].sort()[0] ?? 'A';
}

/** The campaign's own window, never wider than legal quiet hours. */
export function campaignWindow(campaign: { send_window_start_hour: number; send_window_end_hour: number }, quiet: { start: number; end: number; timeZone: string }): SendWindow {
  const legal = quietHoursWindow(quiet.start, quiet.end, quiet.timeZone);
  return intersectWindows({ startHour: campaign.send_window_start_hour, endHour: campaign.send_window_end_hour, timeZone: quiet.timeZone }, legal);
}

/** When a broadcast recipient should receive it: test cohort at launch, holdouts after the decision delay. */
export function broadcastSendTime(scheduledAt: Date, variant: string | null, decideAfterMinutes: number, window: SendWindow): Date {
  const base = variant === null ? new Date(scheduledAt.getTime() + decideAfterMinutes * MINUTE_MS) : scheduledAt;
  return nextSendTime(base, window);
}

/** Drip step time: `delay_minutes` after the previous step (or enrollment), pushed into the send window. */
export function dripStepTime(previousAt: Date, delayMinutes: number, window: SendWindow): Date {
  return nextSendTime(new Date(previousAt.getTime() + delayMinutes * MINUTE_MS), window);
}

export interface ExitFacts {
  bookedSinceEnrollment: boolean;
  repliedSinceEnrollment: boolean;
  unsubscribed: boolean;
}

export function exitReason(exitOn: readonly string[], facts: ExitFacts): ExitReason | null {
  if (exitOn.includes('unsubscribed') && facts.unsubscribed) return 'unsubscribed';
  if (exitOn.includes('booked') && facts.bookedSinceEnrollment) return 'booked';
  if (exitOn.includes('replied') && facts.repliedSinceEnrollment) return 'replied';
  return null;
}

export interface StepLike {
  step_order: number;
  variant: string;
}

/** The step content for a variant, falling back to variant A (or the first defined) for that step. */
export function stepFor<T extends StepLike>(steps: readonly T[], stepOrder: number, variant: string | null): T | null {
  const forOrder = steps.filter((s) => s.step_order === stepOrder).sort((a, b) => a.variant.localeCompare(b.variant));
  return forOrder.find((s) => s.variant === variant) ?? forOrder[0] ?? null;
}

export function nextStepOrder(steps: readonly StepLike[], current: number): number | null {
  const later = [...new Set(steps.map((s) => s.step_order))].filter((o) => o > current).sort((a, b) => a - b);
  return later[0] ?? null;
}

export function variantsOf(steps: readonly StepLike[], stepOrder = 1): string[] {
  return [...new Set(steps.filter((s) => s.step_order === stepOrder).map((s) => s.variant))].sort();
}

// ─── Send-time optimization ─────────────────────────────────────────────────

/** Minimum opens/clicks/bookings before a personal send hour is trusted. */
export const STO_MIN_SIGNALS = 2;

/** Most common local hour of past engagement that falls inside the window; ties go earliest. */
export function bestSendHour(engagedAt: readonly Date[], window: SendWindow): number | null {
  const counts = new Map<number, number>();
  for (const at of engagedAt) {
    const { hour } = localClock(at, window.timeZone);
    if (hour >= window.startHour && hour < window.endHour) counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const top = ranked[0];
  return top && [...counts.values()].reduce((a, b) => a + b, 0) >= STO_MIN_SIGNALS ? top[0] : null;
}

/** The first time at or after `scheduledAt` (within 24h) at the recipient's best hour. */
export function optimizedSendTime(scheduledAt: Date, bestHour: number | null, window: SendWindow): Date {
  if (bestHour === null) return nextSendTime(scheduledAt, window);
  const { hour, minute } = localClock(scheduledAt, window.timeZone);
  if (hour === bestHour) return nextSendTime(scheduledAt, window);
  const hoursAhead = (bestHour - hour + 24) % 24;
  const candidate = new Date(scheduledAt.getTime() + hoursAhead * 60 * MINUTE_MS - minute * MINUTE_MS);
  candidate.setUTCSeconds(0, 0);
  return nextSendTime(candidate, window);
}

// ─── SMS cost ───────────────────────────────────────────────────────────────

/** Recipients × segments × per-segment fee (MMS is a flat per-message fee). Whole cents, rounded up. */
export function estimateSmsCostCents(input: { recipients: number; segments: number; segmentFeeMillicents: number; mmsFeeMillicents: number; hasMedia: boolean }): number {
  const perMessage = input.hasMedia ? input.mmsFeeMillicents : Math.max(1, input.segments) * input.segmentFeeMillicents;
  return Math.ceil((Math.max(0, input.recipients) * perMessage) / 1000);
}
