/**
 * The named request limits.
 *
 * Kept apart from `rate-limit.ts`, which is `server-only` and so cannot be
 * imported by a test at all. The numbers are the part worth asserting on, so
 * they live where they can be.
 */

export interface Limit {
  windowSeconds: number;
  max: number;
}

export const LIMITS = {
  lead: { windowSeconds: 600, max: 5 },
  'lead-partial': { windowSeconds: 600, max: 20 },
  waitlist: { windowSeconds: 600, max: 10 },
  referral: { windowSeconds: 60, max: 30 },
  'report-feed': { windowSeconds: 3600, max: 60 },
  preferences: { windowSeconds: 60, max: 20 },
} as const satisfies Record<string, Limit>;

export type Bucket = keyof typeof LIMITS;
