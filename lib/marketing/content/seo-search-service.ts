import 'server-only';
import { resolveConnection } from './channels/registry';
import { GSC_SCOPE, fetchGbpPerformance, fetchGscPages, patchGbpProfile, readGbpProfile } from './channels/google-seo';
import { adminDb, fail, type Db, type Result } from './db';
import { auditProfile, profilePatch, serviceList, type GbpProfileFields, type ProfileAudit } from './gbp-profile';
import { dayRange, pageTrends, simulateSearchRow, type MetricRow, type PageTrend } from './search-metrics';
import { shopToday, type Closure } from './seo-local';

/**
 * Search Console + Business Profile performance import, content-decay alerts
 * and the Business Profile manager. Every read and write runs in demo mode
 * with clearly-labelled sample numbers until Google is connected.
 */

/** Two 28-day windows so a trend can be compared. */
const IMPORT_DAYS = 56;
/** Google reports lag by ~3 days. */
const LAG_DAYS = 3;

/** Site paths worth watching; the demo import writes numbers for these. */
const DEMO_PAGES = ['/', '/duramax', '/powerstroke', '/cummins', '/store', '/builds', '/blog', '/faq', '/service-areas'] as const;
/** Pages the demo data shows fading, so decay alerts are exercised. */
const DEMO_DECAY_PAGES = new Set<string>(['/blog', '/service-areas']);

type Source = 'gsc' | 'gbp';

async function loadProfileRow(db: Db) {
  const { data } = await db.from('gbp_profile').select('*').eq('id', 1).maybeSingle();
  return data;
}

async function loadClosures(db: Db): Promise<Closure[]> {
  const { data } = await db.from('shop_closures').select('*').gte('ends_on', shopToday()).order('starts_on').limit(20);
  return (data ?? []).map((c) => ({ id: c.id, label: c.label, message: c.message, startsOn: c.starts_on, endsOn: c.ends_on, closed: c.closed }));
}

function toFields(row: { description: string | null; primary_category: string | null; services: string | null; hours_note: string | null } | null): GbpProfileFields {
  return { description: row?.description ?? null, primaryCategory: row?.primary_category ?? null, services: row?.services ?? null, hoursNote: row?.hours_note ?? null };
}

/** True when the stored Google connection also carries the Search Console scope. */
async function hasGscScope(db: Db): Promise<boolean> {
  const { data } = await db.from('channel_connections').select('scopes').eq('platform', 'gbp').maybeSingle();
  return (data?.scopes ?? []).includes(GSC_SCOPE);
}

function demoRows(source: Source, lastDay: string): MetricRow[] {
  const days = dayRange(lastDay, IMPORT_DAYS);
  if (source === 'gbp') return days.map((day) => simulateSearchRow('gbp', 'profile', day));
  return days.flatMap((day, index) =>
    DEMO_PAGES.map((page) => {
      // Older half full strength, recent half faded for the decay pages.
      const decay = DEMO_DECAY_PAGES.has(page) && index >= IMPORT_DAYS / 2 ? 0.55 : 0;
      return simulateSearchRow('gsc', page, day, decay);
    }),
  );
}

async function storeRows(db: Db, rows: readonly MetricRow[], isSample: boolean): Promise<number> {
  if (!rows.length) return 0;
  const { error } = await db.from('search_metrics_daily').upsert(
    rows.map((r) => ({ source: r.source, day: r.day, page: r.page, clicks: r.clicks, impressions: r.impressions, position: r.position, is_sample: isSample })),
    { onConflict: 'source,day,page' },
  );
  if (error) throw new Error(error.message);
  return rows.length;
}

export interface ImportSummary {
  gbp: { rows: number; live: boolean; note: string };
  gsc: { rows: number; live: boolean; note: string };
}

/**
 * Pulls the last 56 days of Business Profile and Search Console numbers.
 * Without a live Google connection it writes sample rows instead, so decay
 * alerts and the dashboard work before the account exists.
 */
export async function importSearchData(db: Db = adminDb()): Promise<Result<ImportSummary>> {
  try {
    const lastDay = new Date(Date.now() - LAG_DAYS * 86_400_000).toISOString().slice(0, 10);
    const firstDay = dayRange(lastDay, IMPORT_DAYS)[0];
    const connection = await resolveConnection('gbp', db);
    const live = connection.mode === 'live' && connection.credentials !== null;
    const summary: ImportSummary = {
      gbp: { rows: 0, live: false, note: connection.demoReason ?? 'demo data' },
      gsc: { rows: 0, live: false, note: 'Search Console not connected' },
    };

    if (live && connection.credentials) {
      try {
        const rows = await fetchGbpPerformance(connection.credentials, firstDay, lastDay);
        summary.gbp = { rows: await storeRows(db, rows, false), live: true, note: 'Business Profile' };
      } catch (error) {
        summary.gbp.note = error instanceof Error ? error.message : String(error);
      }
      if (await hasGscScope(db)) {
        try {
          const site = process.env.GSC_SITE_URL ?? '';
          if (!site) throw new Error('GSC_SITE_URL is not set');
          const rows = await fetchGscPages(connection.credentials, site, firstDay, lastDay);
          summary.gsc = { rows: await storeRows(db, rows, false), live: true, note: 'Search Console' };
        } catch (error) {
          summary.gsc.note = error instanceof Error ? error.message : String(error);
        }
      }
    }
    if (!summary.gbp.live) summary.gbp.rows = await storeRows(db, demoRows('gbp', lastDay), true);
    if (!summary.gsc.live) summary.gsc.rows = await storeRows(db, demoRows('gsc', lastDay), true);
    return { ok: true, data: summary };
  } catch (error) {
    return fail(error);
  }
}

export interface SearchStatus {
  profile: GbpProfileFields & { services: string | null; lastPushAt: string | null; lastPushNote: string | null };
  audit: ProfileAudit;
  serviceCount: number;
  connected: boolean;
  connectionNote: string;
  sample: boolean;
  lastDay: string | null;
  trends: PageTrend[];
  decayed: PageTrend[];
  profileTrend: PageTrend | null;
}

/** Business Profile record, its audit, page trends and the decay list. */
export async function getSearchStatus(db: Db = adminDb()): Promise<SearchStatus> {
  const from = dayRange(shopToday(), IMPORT_DAYS * 2)[0];
  const [row, closures, { data: metrics }, connection] = await Promise.all([
    loadProfileRow(db),
    loadClosures(db),
    db.from('search_metrics_daily').select('source, day, page, clicks, impressions, position, is_sample').gte('day', from).order('day', { ascending: false }).limit(4000),
    resolveConnection('gbp', db),
  ]);
  const rows = (metrics ?? []).map((m) => ({ source: m.source as Source, day: m.day, page: m.page, clicks: m.clicks, impressions: m.impressions, position: m.position }));
  const lastDay = rows[0]?.day ?? null;
  const today = lastDay ?? shopToday();
  const trends = pageTrends(rows.filter((r) => r.source === 'gsc'), today);
  const profileTrends = pageTrends(rows.filter((r) => r.source === 'gbp'), today);
  const fields = toFields(row);
  return {
    profile: { ...fields, lastPushAt: row?.last_push_at ?? null, lastPushNote: row?.last_push_note ?? null },
    audit: auditProfile(fields, closures),
    serviceCount: serviceList(fields.services).length,
    connected: connection.mode === 'live',
    connectionNote: connection.demoReason ?? 'connected',
    sample: (metrics ?? []).some((m) => m.is_sample),
    lastDay,
    trends: trends.slice(0, 10),
    decayed: trends.filter((t) => t.decayed),
    profileTrend: profileTrends[0] ?? null,
  };
}

export async function saveGbpProfile(fields: GbpProfileFields, db: Db = adminDb()): Promise<Result> {
  try {
    const { error } = await db.from('gbp_profile').upsert({
      id: 1, description: fields.description, primary_category: fields.primaryCategory, services: fields.services, hours_note: fields.hoursNote,
    }, { onConflict: 'id' });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

/** Pushes the description and holiday closures to Google, or records the demo attempt. */
export async function pushGbpProfile(db: Db = adminDb()): Promise<Result<{ note: string }>> {
  try {
    const [row, closures, connection] = await Promise.all([loadProfileRow(db), loadClosures(db), resolveConnection('gbp', db)]);
    const fields = toFields(row);
    const patch = profilePatch(fields, closures);
    let note: string;
    if (connection.mode === 'live' && connection.credentials) {
      await patchGbpProfile(connection.credentials, patch);
      note = `Sent to Google: ${patch.updateMask.join(', ')}.`;
    } else {
      note = `Demo: ${patch.updateMask.join(', ')} ready (${connection.demoReason ?? 'not connected'}).`;
    }
    const { error } = await db.from('gbp_profile').update({ last_push_at: new Date().toISOString(), last_push_note: note.slice(0, 300) }).eq('id', 1);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { note } };
  } catch (error) {
    return fail(error);
  }
}

/** Pulls the description and category from Google into the app, when connected. */
export async function pullGbpProfile(db: Db = adminDb()): Promise<Result<{ note: string }>> {
  try {
    const connection = await resolveConnection('gbp', db);
    if (connection.mode !== 'live' || !connection.credentials) return { ok: false, error: `Google is not connected (${connection.demoReason ?? 'demo'}).` };
    const remote = await readGbpProfile(connection.credentials);
    const row = await loadProfileRow(db);
    const { error } = await db.from('gbp_profile').upsert({
      id: 1, description: remote.description ?? row?.description ?? null, primary_category: remote.primaryCategory ?? row?.primary_category ?? null,
      services: row?.services ?? null, hours_note: row?.hours_note ?? null,
    }, { onConflict: 'id' });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { note: 'Pulled from Google.' } };
  } catch (error) {
    return fail(error);
  }
}
