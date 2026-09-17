import { hashSeed, seededRandom } from './demo-generator';

/**
 * Search performance maths: per-page trends over two equal windows and the
 * content-decay rule. Pure, so the admin page, the import job and the tests
 * share one definition. Data comes from Search Console (site pages) or the
 * Google Business Profile (source `gbp`, page `profile`).
 */

export interface MetricRow {
  source: 'gsc' | 'gbp';
  day: string;
  page: string;
  clicks: number;
  impressions: number;
  position: number | null;
}

/** Days per comparison window: 28 covers four full weeks. */
export const WINDOW_DAYS = 28;
/** Below this many clicks in the earlier window, a drop is noise. */
export const DECAY_MIN_CLICKS = 10;
/** Share of clicks a page must lose to count as decayed. */
export const DECAY_DROP = 0.3;

export interface PageTrend {
  page: string;
  clicks: number;
  priorClicks: number;
  impressions: number;
  /** Impression-weighted average position in the recent window. */
  position: number | null;
  /** -1…+n. Null when there is nothing to compare against. */
  change: number | null;
  decayed: boolean;
}

function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of the `count` days ending on `lastDay`. */
export function dayRange(lastDay: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftDay(lastDay, i - count + 1));
}

interface Bucket {
  clicks: number;
  impressions: number;
  positionWeight: number;
  positionSum: number;
}

function empty(): Bucket {
  return { clicks: 0, impressions: 0, positionWeight: 0, positionSum: 0 };
}

function add(bucket: Bucket, row: MetricRow): void {
  bucket.clicks += row.clicks;
  bucket.impressions += row.impressions;
  if (row.position !== null && row.impressions > 0) {
    bucket.positionWeight += row.impressions;
    bucket.positionSum += row.position * row.impressions;
  }
}

/**
 * Per-page totals for the last `window` days ending today against the window
 * before it, busiest page first.
 */
export function pageTrends(rows: readonly MetricRow[], today: string, window = WINDOW_DAYS): PageTrend[] {
  const recentFrom = shiftDay(today, 1 - window);
  const priorFrom = shiftDay(today, 1 - window * 2);
  const recent = new Map<string, Bucket>();
  const prior = new Map<string, Bucket>();
  for (const row of rows) {
    const target = row.day >= recentFrom && row.day <= today ? recent : row.day >= priorFrom && row.day < recentFrom ? prior : null;
    if (!target) continue;
    const bucket = target.get(row.page) ?? empty();
    add(bucket, row);
    target.set(row.page, bucket);
  }
  const pages = new Set([...recent.keys(), ...prior.keys()]);
  return [...pages]
    .map((page) => {
      const now = recent.get(page) ?? empty();
      const before = prior.get(page) ?? empty();
      const change = before.clicks > 0 ? (now.clicks - before.clicks) / before.clicks : null;
      return {
        page,
        clicks: now.clicks,
        priorClicks: before.clicks,
        impressions: now.impressions,
        position: now.positionWeight > 0 ? Math.round((now.positionSum / now.positionWeight) * 10) / 10 : null,
        change,
        decayed: before.clicks >= DECAY_MIN_CLICKS && now.clicks <= before.clicks * (1 - DECAY_DROP),
      };
    })
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
}

export function decayedPages(trends: readonly PageTrend[]): PageTrend[] {
  return trends.filter((t) => t.decayed);
}

export function windowTotals(trends: readonly PageTrend[]): { clicks: number; impressions: number; priorClicks: number } {
  return trends.reduce(
    (total, t) => ({ clicks: total.clicks + t.clicks, impressions: total.impressions + t.impressions, priorClicks: total.priorClicks + t.priorClicks }),
    { clicks: 0, impressions: 0, priorClicks: 0 },
  );
}

/**
 * Deterministic stand-in numbers for one page and day, used until Search
 * Console or the Business Profile is connected. Always stored as sample data.
 * A gentle downward drift on older-looking pages so decay alerts are real.
 */
export function simulateSearchRow(source: 'gsc' | 'gbp', page: string, day: string, decay = 0): MetricRow {
  const random = seededRandom(hashSeed(`${source}|${page}|${day}`));
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const weekendDip = weekday === 0 || weekday === 6 ? 0.6 : 1;
  const base = source === 'gbp' ? 90 : 26;
  const impressions = Math.max(1, Math.round(base * (0.6 + random() * 0.8) * weekendDip * (1 - decay)));
  const ctr = source === 'gbp' ? 0.06 + random() * 0.05 : 0.02 + random() * 0.05;
  return {
    source,
    day,
    page,
    impressions,
    clicks: Math.round(impressions * ctr),
    position: source === 'gsc' ? Math.round((6 + random() * 18) * 10) / 10 : null,
  };
}
