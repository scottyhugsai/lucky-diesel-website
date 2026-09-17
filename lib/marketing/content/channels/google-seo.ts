import type { MetricRow } from '../search-metrics';
import type { ProfilePatch } from '../gbp-profile';
import { ChannelError, type Credentials } from './types';

/**
 * Google read/write calls for local SEO: the Business Profile record, its
 * performance numbers and Search Console pages. Live only — callers fall back
 * to demo data when the Google connection is in demo mode or lacks the scope.
 */

const TIMEOUT_MS = 15_000;
const INFO_API = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const PERF_API = 'https://businessprofileperformance.googleapis.com/v1';
const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3';

export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

/** `accounts/1/locations/2` and `locations/2` both resolve to `locations/2`. */
export function locationName(externalAccountId: string | null): string {
  const at = externalAccountId?.indexOf('locations/') ?? -1;
  if (!externalAccountId || at < 0) throw new ChannelError('GBP location (accounts/…/locations/…) is not set on the connection', 'gbp');
  return externalAccountId.slice(at);
}

async function call<T>(url: string, init: RequestInit & { token: string }): Promise<T> {
  const { token, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) throw new ChannelError(`Google: ${data.error?.message ?? `HTTP ${response.status}`}`, 'gbp');
  return data as T;
}

export interface RemoteProfile {
  description: string | null;
  primaryCategory: string | null;
}

export async function readGbpProfile(credentials: Credentials): Promise<RemoteProfile> {
  const location = locationName(credentials.externalAccountId);
  const data = await call<{ profile?: { description?: string }; categories?: { primaryCategory?: { displayName?: string } } }>(
    `${INFO_API}/${location}?readMask=profile,categories`,
    { token: credentials.accessToken },
  );
  return { description: data.profile?.description ?? null, primaryCategory: data.categories?.primaryCategory?.displayName ?? null };
}

export async function patchGbpProfile(credentials: Credentials, patch: ProfilePatch): Promise<void> {
  const location = locationName(credentials.externalAccountId);
  await call(`${INFO_API}/${location}?updateMask=${encodeURIComponent(patch.updateMask.join(','))}`, {
    token: credentials.accessToken,
    method: 'PATCH',
    body: JSON.stringify(patch.body),
  });
}

const IMPRESSION_METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
] as const;

interface TimeSeriesResponse {
  multiDailyMetricTimeSeries?: {
    dailyMetricTimeSeries?: {
      dailyMetric?: string;
      timeSeries?: { datedValues?: { date?: { year?: number; month?: number; day?: number }; value?: string }[] };
    }[];
  }[];
}

function dayKey(date: { year?: number; month?: number; day?: number } | undefined): string | null {
  if (!date?.year || !date.month || !date.day) return null;
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

/** Business Profile views and website clicks per day, as one `profile` row per day. */
export async function fetchGbpPerformance(credentials: Credentials, from: string, to: string): Promise<MetricRow[]> {
  const location = locationName(credentials.externalAccountId);
  const [fy, fm, fd] = from.split('-');
  const [ty, tm, td] = to.split('-');
  const params = new URLSearchParams();
  for (const metric of ['WEBSITE_CLICKS', ...IMPRESSION_METRICS]) params.append('dailyMetrics', metric);
  params.set('dailyRange.start_date.year', fy);
  params.set('dailyRange.start_date.month', fm);
  params.set('dailyRange.start_date.day', fd);
  params.set('dailyRange.end_date.year', ty);
  params.set('dailyRange.end_date.month', tm);
  params.set('dailyRange.end_date.day', td);
  const data = await call<TimeSeriesResponse>(`${PERF_API}/${location}:fetchMultiDailyMetricsTimeSeries?${params}`, { token: credentials.accessToken });

  const byDay = new Map<string, { clicks: number; impressions: number }>();
  for (const multi of data.multiDailyMetricTimeSeries ?? []) {
    for (const series of multi.dailyMetricTimeSeries ?? []) {
      const isClick = series.dailyMetric === 'WEBSITE_CLICKS';
      for (const point of series.timeSeries?.datedValues ?? []) {
        const day = dayKey(point.date);
        if (!day) continue;
        const value = Number(point.value ?? 0);
        const row = byDay.get(day) ?? { clicks: 0, impressions: 0 };
        if (isClick) row.clicks += Number.isFinite(value) ? value : 0;
        else row.impressions += Number.isFinite(value) ? value : 0;
        byDay.set(day, row);
      }
    }
  }
  return [...byDay.entries()].map(([day, row]) => ({ source: 'gbp' as const, day, page: 'profile', clicks: row.clicks, impressions: row.impressions, position: null }));
}

interface GscResponse {
  rows?: { keys?: string[]; clicks?: number; impressions?: number; position?: number }[];
}

/** Search Console clicks per page per day, paths only. */
export async function fetchGscPages(credentials: Credentials, siteUrl: string, from: string, to: string): Promise<MetricRow[]> {
  const data = await call<GscResponse>(`${GSC_API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    token: credentials.accessToken,
    method: 'POST',
    body: JSON.stringify({ startDate: from, endDate: to, dimensions: ['page', 'date'], rowLimit: 5000, type: 'web' }),
  });
  return (data.rows ?? []).flatMap((row) => {
    const [page, day] = row.keys ?? [];
    if (!page || !day) return [];
    let path = page;
    try {
      path = new URL(page).pathname || '/';
    } catch {
      // Keep the raw key if Google ever returns a non-URL.
    }
    return [{
      source: 'gsc' as const,
      day,
      page: path.slice(0, 300),
      clicks: Math.round(row.clicks ?? 0),
      impressions: Math.round(row.impressions ?? 0),
      position: row.position ? Math.round(row.position * 10) / 10 : null,
    }];
  });
}
