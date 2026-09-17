import 'server-only';
import { adminDb, type Db } from '@/lib/marketing/content/db';
import { shopDay } from '@/lib/marketing/content/calendar';

export interface CalendarPost {
  id: string;
  title: string;
  status: string;
  scheduledFor: string | null;
  day: string | null;
  pillar: string | null;
  complianceStatus: string;
  needsPrivacyReview: boolean;
  targets: { platform: string; status: string }[];
}

export interface MediaOption {
  value: string;
  title: string;
  url: string;
  group: 'Gallery' | 'Builds' | 'Job photos';
}

const DAY_MS = 86_400_000;
const PREVIEW_SECONDS = 3600;

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function todayShop(): string {
  return shopDay(new Date()).date;
}

/** Monday-first week containing `date`. */
export function weekDays(date: string): string[] {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const monday = addDays(date, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Six Monday-first weeks covering the month of `date`. */
export function monthDays(date: string): string[] {
  const first = weekDays(`${date.slice(0, 8)}01`)[0]!;
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export async function postsBetween(fromDate: string, toDate: string, db: Db = adminDb()): Promise<CalendarPost[]> {
  const { data } = await db
    .from('social_posts')
    .select('id, title, status, scheduled_for, pillar, compliance_status, needs_privacy_review, social_post_targets(platform, status)')
    .gte('scheduled_for', new Date(Date.parse(`${fromDate}T00:00:00Z`) - DAY_MS).toISOString())
    .lte('scheduled_for', new Date(Date.parse(`${toDate}T23:59:59Z`) + DAY_MS).toISOString())
    .order('scheduled_for');
  return (data ?? []).map((p) => ({
    id: p.id, title: p.title, status: p.status, scheduledFor: p.scheduled_for, day: p.scheduled_for ? shopDay(new Date(p.scheduled_for)).date : null,
    pillar: p.pillar, complianceStatus: p.compliance_status, needsPrivacyReview: p.needs_privacy_review,
    targets: [...p.social_post_targets].sort((a, b) => a.platform.localeCompare(b.platform)),
  }));
}

/** Owner photos the post can use: gallery, build heroes and job photos (signed, private bucket). */
export async function mediaOptions(db: Db = adminDb()): Promise<MediaOption[]> {
  const [{ data: gallery }, { data: builds }, { data: media }] = await Promise.all([
    db.from('gallery_items').select('id, title, image_url').eq('published', true).order('sort').limit(12),
    db.from('builds').select('id, title, hero_image').eq('published', true).order('created_at', { ascending: false }).limit(8),
    db.from('media').select('id, caption, bucket, path').eq('kind', 'photo').order('created_at', { ascending: false }).limit(8),
  ]);
  const jobs = await Promise.all((media ?? []).map(async (m) => {
    const { data } = await db.storage.from(m.bucket).createSignedUrl(m.path, PREVIEW_SECONDS);
    return data?.signedUrl ? { value: `media:${m.id}`, title: m.caption ?? 'Job photo', url: data.signedUrl, group: 'Job photos' as const } : null;
  }));
  return [
    ...(gallery ?? []).map((g) => ({ value: `gallery:${g.id}`, title: g.title, url: g.image_url, group: 'Gallery' as const })),
    ...(builds ?? []).filter((b) => b.hero_image).map((b) => ({ value: `build:${b.id}`, title: b.title, url: b.hero_image, group: 'Builds' as const })),
    ...jobs.filter((j): j is NonNullable<typeof j> => j !== null),
  ];
}

export interface DraftSources {
  builds: { id: string; title: string; drafted: boolean }[];
  dynoRuns: { id: string; label: string; drafted: boolean }[];
}

/** Recent builds and dyno pulls that can become posts, flagged if already drafted. */
export async function draftSources(db: Db = adminDb()): Promise<DraftSources> {
  const [{ data: builds }, { data: runs }, { data: posts }] = await Promise.all([
    db.from('builds').select('id, title').eq('published', true).order('created_at', { ascending: false }).limit(6),
    db.from('dyno_runs').select('id, label, horsepower, run_at').eq('is_baseline', false).order('run_at', { ascending: false }).limit(6),
    db.from('social_posts').select('source_type, source_id').in('source_type', ['build', 'dyno_run']),
  ]);
  const drafted = new Set((posts ?? []).map((p) => `${p.source_type}:${p.source_id}`));
  return {
    builds: (builds ?? []).map((b) => ({ id: b.id, title: b.title, drafted: drafted.has(`build:${b.id}`) })),
    dynoRuns: (runs ?? []).map((r) => ({ id: r.id, label: `${r.label}${r.horsepower ? ` · ${r.horsepower} hp` : ''}`, drafted: drafted.has(`dyno_run:${r.id}`) })),
  };
}
