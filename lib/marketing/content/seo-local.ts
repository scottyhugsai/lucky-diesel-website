import { BUSINESS, PLATFORMS } from '@/lib/site';
import { slugify } from './seo';

/** Service areas, closures banner, recurring SEO tasks and internal links. Pure helpers. */

export interface ServiceArea {
  slug: string;
  name: string;
}

export const SERVICE_AREAS: readonly ServiceArea[] = BUSINESS.areaServed.map((name) => ({ slug: slugify(name), name }));

export function findArea(slug: string): ServiceArea | null {
  return SERVICE_AREAS.find((a) => a.slug === slug) ?? null;
}

// ── Closures ──

export interface Closure {
  id: string;
  label: string;
  message: string | null;
  startsOn: string;
  endsOn: string;
  closed: boolean;
}

/** Today's date in the shop's time zone as YYYY-MM-DD. */
export function shopToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Days the banner shows before a closure starts. */
export const CLOSURE_LEAD_DAYS = 7;

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The closure to announce: in progress, or starting within the lead window. Earliest first. */
export function bannerClosure(closures: readonly Closure[], today: string): Closure | null {
  const horizon = addDays(today, CLOSURE_LEAD_DAYS);
  return [...closures]
    .filter((c) => c.endsOn >= today && c.startsOn <= horizon)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0] ?? null;
}

function formatDay(day: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${day}T12:00:00Z`));
}

export function closureText(c: Closure): string {
  const range = c.startsOn === c.endsOn ? formatDay(c.startsOn) : `${formatDay(c.startsOn)} – ${formatDay(c.endsOn)}`;
  const state = c.closed ? 'Closed' : 'Special hours';
  return `${c.label}: ${state} ${range}.${c.message ? ` ${c.message}` : ''}`;
}

// ── Recurring tasks ──

/** A done task with a repeat interval comes due again after that many days. */
export function taskIsDue(task: { status: string; repeatDays: number | null; doneAt: string | null }, now: Date = new Date()): boolean {
  if (task.status === 'skip') return false;
  if (task.status !== 'done') return true;
  if (!task.repeatDays || !task.doneAt) return false;
  return now.getTime() - new Date(task.doneAt).getTime() >= task.repeatDays * 86_400_000;
}

// ── Internal links ──

export interface RelatedLink {
  href: string;
  label: string;
  kind: 'platform' | 'store' | 'build' | 'post' | 'area';
}

export const MAX_RELATED = 6;

/**
 * Related links for a page: its platform page and parts, then sibling builds
 * and posts (same platform first), never the page itself.
 */
export function relatedLinks(input: {
  platform: string | null;
  selfHref: string;
  builds: readonly { slug: string; title: string; platform: string }[];
  posts: readonly { slug: string; title: string; platform: string | null }[];
}): RelatedLink[] {
  const platform = PLATFORMS.find((p) => p.id === input.platform) ?? null;
  const links: RelatedLink[] = [];
  if (platform) {
    links.push({ href: `/${platform.id}`, label: `${platform.name} service`, kind: 'platform' });
    links.push({ href: `/store/products?platform=${platform.id}`, label: `${platform.name} parts`, kind: 'store' });
  }
  const samePlatformFirst = <T extends { platform: string | null }>(rows: readonly T[]) =>
    [...rows].sort((a, b) => Number(b.platform === input.platform) - Number(a.platform === input.platform));
  for (const b of samePlatformFirst(input.builds)) links.push({ href: `/builds/${b.slug}`, label: b.title, kind: 'build' });
  for (const p of samePlatformFirst(input.posts)) links.push({ href: `/blog/${p.slug}`, label: p.title, kind: 'post' });
  const seen = new Set<string>([input.selfHref]);
  return links.filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true))).slice(0, MAX_RELATED);
}
