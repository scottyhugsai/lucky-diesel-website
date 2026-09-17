import { SHOP_TIME_ZONE } from '@/lib/format';
import { shopWallTime } from '@/lib/scheduling/slots';
import type { SocialPlatform } from './types';

/**
 * Posting-time suggestions and recurring content pillars, in shop-local time.
 * Windows are sensible local-business defaults (lunch and after-work for
 * Instagram/TikTok, business hours for Facebook/GBP); the owner can override.
 */

export interface PostingWindow {
  /** 0 = Sunday … 6 = Saturday */
  weekdays: readonly number[];
  hours: readonly number[];
}

export const POSTING_WINDOWS: Record<SocialPlatform, PostingWindow> = {
  instagram: { weekdays: [2, 3, 4, 5, 6], hours: [12, 17, 19] },
  facebook: { weekdays: [1, 2, 3, 4, 5], hours: [9, 12, 18] },
  gbp: { weekdays: [2, 4], hours: [10] },
  tiktok: { weekdays: [2, 3, 4, 6], hours: [18, 19, 20] },
};

export type PillarKey = 'build_of_the_month' | 'tip_tuesday' | 'product_spotlight';

export interface Pillar {
  key: PillarKey;
  name: string;
  description: string;
  /** Returns true when a shop-local date (YYYY-MM-DD, weekday) hosts this pillar. */
  matches: (date: string, weekday: number) => boolean;
  hour: number;
}

export const CONTENT_PILLARS: readonly Pillar[] = [
  {
    key: 'build_of_the_month',
    name: 'Build of the month',
    description: 'First Friday: the best published build, with its dyno card.',
    matches: (date, weekday) => weekday === 5 && Number(date.slice(8, 10)) <= 7,
    hour: 12,
  },
  { key: 'tip_tuesday', name: 'Tip Tuesday', description: 'One practical maintenance tip for diesel owners.', matches: (_d, weekday) => weekday === 2, hour: 12 },
  { key: 'product_spotlight', name: 'Product spotlight', description: 'Thursday: a part we stock and install, with the real store price.', matches: (_d, weekday) => weekday === 4, hour: 17 },
];

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const MAX_SCAN_DAYS = 60;

/** Shop-local calendar date and weekday for an instant. */
export function shopDay(at: Date): { date: string; weekday: number } {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIME_ZONE }).format(at);
  return { date, weekday: new Date(`${date}T12:00:00Z`).getUTCDay() };
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function clashes(candidate: Date, taken: readonly Date[], minGapHours: number): boolean {
  return taken.some((t) => Math.abs(t.getTime() - candidate.getTime()) < minGapHours * HOUR_MS);
}

/**
 * The next `count` good posting times for a platform after `from`, keeping at
 * least `minGapHours` from anything already scheduled (and from each other).
 */
export function suggestPostingTimes(platform: SocialPlatform, from: Date, count: number, taken: readonly Date[] = [], minGapHours = 20): Date[] {
  const window = POSTING_WINDOWS[platform];
  const picked: Date[] = [];
  let date = shopDay(from).date;
  for (let day = 0; day < MAX_SCAN_DAYS && picked.length < count; day += 1, date = addDays(date, 1)) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (!window.weekdays.includes(weekday)) continue;
    for (const hour of window.hours) {
      const candidate = shopWallTime(date, hour);
      if (candidate <= from || clashes(candidate, [...taken, ...picked], minGapHours)) continue;
      picked.push(candidate);
      break;
    }
  }
  return picked;
}

/** Every pillar slot between two instants, in date order. */
export function pillarOccurrences(from: Date, to: Date, pillars: readonly Pillar[] = CONTENT_PILLARS): { pillar: PillarKey; at: Date }[] {
  const out: { pillar: PillarKey; at: Date }[] = [];
  const last = shopDay(to).date;
  for (let date = shopDay(from).date, i = 0; date <= last && i < MAX_SCAN_DAYS * 6; date = addDays(date, 1), i += 1) {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    for (const pillar of pillars) {
      if (!pillar.matches(date, weekday)) continue;
      const at = shopWallTime(date, pillar.hour);
      if (at > from && at <= to) out.push({ pillar: pillar.key, at });
    }
  }
  return out;
}

export interface DraftToSchedule {
  id: string;
  platform: SocialPlatform;
  /** Earliest acceptable time, e.g. "after the build page goes live". */
  notBefore?: Date;
}

/** Assigns each draft its own slot without double-booking a platform. Input order is priority order. */
export function scheduleDrafts(drafts: readonly DraftToSchedule[], from: Date, existing: readonly { platform: SocialPlatform; at: Date }[] = []): { id: string; platform: SocialPlatform; at: Date }[] {
  const booked = existing.map((e) => ({ ...e }));
  const result: { id: string; platform: SocialPlatform; at: Date }[] = [];
  for (const draft of drafts) {
    const start = draft.notBefore && draft.notBefore > from ? draft.notBefore : from;
    const taken = booked.filter((b) => b.platform === draft.platform).map((b) => b.at);
    const [at] = suggestPostingTimes(draft.platform, start, 1, taken);
    if (!at) continue;
    booked.push({ platform: draft.platform, at });
    result.push({ id: draft.id, platform: draft.platform, at });
  }
  return result;
}
