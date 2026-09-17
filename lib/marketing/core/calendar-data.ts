import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { SEASONS } from '@/lib/marketing/content/copy-library';
import { dayKey, startOfDayInZone } from './analytics-math';
import { getDailyStats } from './analytics';
import { monthBounds, seasonEntries, type CalendarEntry } from './marketing-calendar';
import { getMarketingSettings, type Db } from './settings';
import type { DayStat } from './analytics-math';

/** Campaigns, posts, events, offers, ad flights and seasons for one month, plus the daily leads/revenue series under them. */

const day = (value: string | null): string | null => (value ? dayKey(value) : null);

/** PostgREST `or` filter: any of these timestamp columns falls inside the window. */
const inWindow = (columns: readonly string[], from: string, to: string): string =>
  columns.map((c) => `and(${c}.gte.${from},${c}.lte.${to})`).join(',');

export interface CalendarData {
  month: string;
  entries: CalendarEntry[];
  days: DayStat[];
}

export async function loadCalendar(month: string, db: Db = createAdminClient()): Promise<CalendarData> {
  const { first, last } = monthBounds(month);
  const from = startOfDayInZone(first);
  const to = new Date(startOfDayInZone(last).getTime() + 86_400_000 - 1);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const [campaigns, posts, events, offers, ads, settings, days] = await Promise.all([
    db.from('campaigns').select('id, name, status, scheduled_at, started_at, completed_at').or(inWindow(['scheduled_at', 'started_at'], fromIso, toIso)).limit(200),
    db.from('social_posts').select('id, title, status, scheduled_for, published_at').or(inWindow(['scheduled_for', 'published_at'], fromIso, toIso)).limit(300),
    db.from('events').select('id, name, kind, starts_at, ends_at, published').gte('starts_at', fromIso).lte('starts_at', toIso).limit(100),
    db.from('offers').select('id, name, active, starts_at, ends_at').limit(200),
    db.from('ad_campaigns').select('id, name, platform, status, starts_on, ends_on').limit(200),
    getMarketingSettings(db),
    getDailyStats(db, from, to).catch(() => [] as DayStat[]),
  ]);

  const entries: CalendarEntry[] = [];
  const push = (entry: CalendarEntry | null) => {
    if (entry && entry.start <= last && entry.end >= first) entries.push(entry);
  };

  for (const c of campaigns.data ?? []) {
    const start = day(c.scheduled_at ?? c.started_at);
    if (!start) continue;
    push({ id: `campaign-${c.id}`, kind: 'campaign', title: c.name, start, end: day(c.completed_at) ?? start, href: `/admin/marketing/campaigns/${c.id}`, status: c.status });
  }
  for (const p of posts.data ?? []) {
    const start = day(p.scheduled_for ?? p.published_at);
    if (!start) continue;
    push({ id: `post-${p.id}`, kind: 'post', title: p.title, start, end: start, href: `/admin/marketing/social/${p.id}`, status: p.status });
  }
  for (const e of events.data ?? []) {
    const start = day(e.starts_at)!;
    push({ id: `event-${e.id}`, kind: 'event', title: e.name, start, end: day(e.ends_at) ?? start, href: `/admin/marketing/growth/events/${e.id}`, status: e.published ? 'published' : 'draft' });
  }
  for (const o of offers.data ?? []) {
    const start = day(o.starts_at) ?? first;
    push({ id: `offer-${o.id}`, kind: 'offer', title: o.name, start, end: day(o.ends_at) ?? last, href: '/admin/marketing/growth', status: o.active ? 'active' : 'paused' });
  }
  for (const a of ads.data ?? []) {
    if (!a.starts_on) continue;
    push({ id: `ad-${a.id}`, kind: 'ad', title: a.name, start: a.starts_on, end: a.ends_on ?? last, href: '/admin/marketing/ads/campaigns', status: a.status });
  }
  const year = Number(month.slice(0, 4));
  for (const entry of seasonEntries(year, Object.entries(SEASONS).flatMap(([key, s]) => (settings.seasonal[key] === false ? [] : [{ key, name: s.name, months: s.months }])))) {
    push(entry);
  }
  return { month, entries, days };
}
