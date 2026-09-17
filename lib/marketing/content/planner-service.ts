import 'server-only';
import { getAvailableSlots } from '@/lib/domain/appointments';
import { getCatalog } from '@/lib/store/catalog';
import { siteUrl } from '@/lib/site-url';
import { ownerContact, sendContentMessage } from './alerts';
import { generateAdCreative, offerFromLanding } from './creative-service';
import { adminDb, buildToRef, dynoRunToRef, recordGeneration, type Db } from './db';
import { planWeek, type PlanItem, type WeeklyPlan } from './planner';
import { draftPostsForBuild, draftPostsForDynoRun } from './social-service';
import type { AdPlatform, BuildRef, OfferRef } from './types';

const DAY_MS = 86_400_000;

function shopDate(offsetDays: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(Date.now() + offsetDays * DAY_MS));
}

/** Gathers this week's real inputs: builds, dyno pulls, store products, offers and open bays. */
export async function proposeWeeklyPlan(db: Db = adminDb()): Promise<WeeklyPlan> {
  const now = new Date();
  const [{ data: builds }, { data: runs }, catalog, { data: pages }, { count: live }, { data: posts }, { data: creatives }] = await Promise.all([
    db.from('builds').select('*').eq('published', true).order('created_at', { ascending: false }).limit(10),
    db.from('dyno_runs').select('id, run_at').eq('is_baseline', false).gte('run_at', new Date(now.getTime() - 14 * DAY_MS).toISOString()).order('run_at', { ascending: false }).limit(4),
    getCatalog(),
    db.from('landing_pages').select('slug, offer').eq('published', true).not('offer', 'is', null),
    db.from('ad_campaigns').select('id', { count: 'exact', head: true }).eq('status', 'live'),
    db.from('social_posts').select('source_type, source_id').gte('created_at', new Date(now.getTime() - 30 * DAY_MS).toISOString()),
    db.from('ad_creatives').select('subject_kind, subject_ref').gte('created_at', new Date(now.getTime() - 30 * DAY_MS).toISOString()),
  ]);

  const dynoRefs = (await Promise.all((runs ?? []).map(async (r) => {
    const ref = await dynoRunToRef(db, r.id);
    return ref && ref.beforeHp ? { ...ref, runAt: r.run_at } : null;
  }))).filter((r): r is BuildRef & { runAt: string } => r !== null);

  const slotCounts = await Promise.all(Array.from({ length: 7 }, (_, i) => getAvailableSlots(shopDate(i)).then((s) => s.length).catch(() => 0)));
  const offers = (pages ?? []).map((p) => offerFromLanding(p)).filter((o): o is OfferRef => o !== null && (!o.endsAt || Date.parse(o.endsAt) > now.getTime()));
  const products = catalog.products
    .filter((p) => p.available && !p.offRoadOnly && ['turbo', 'fuel', 'exhaust'].includes(p.category))
    .sort((a, b) => b.priceMinCents - a.priceMinCents)
    .slice(0, 5)
    .map((p) => ({ handle: p.handle, title: p.title, vendor: p.vendor, category: p.category, priceFromCents: p.priceMinCents, image: p.images[0]?.src ?? null, platforms: p.platforms, offRoadOnly: p.offRoadOnly }));

  const drafted = new Set<string>([
    ...(posts ?? []).map((p) => `social:${p.source_type === 'dyno_run' ? 'dyno' : p.source_type}:${p.source_id}`),
    ...(creatives ?? []).map((c) => `ad:${c.subject_kind}:${c.subject_ref}`),
  ]);
  return planWeek({
    now, builds: (builds ?? []).map((b) => ({ ...buildToRef(b), createdAt: b.created_at })), dynoRuns: dynoRefs, products, offers,
    openSlotsThisWeek: slotCounts.reduce((t, n) => t + n, 0), liveCampaigns: live ?? 0, alreadyDrafted: drafted,
  });
}

async function executeItem(item: PlanItem, requestedBy: string | null, db: Db): Promise<string> {
  if (item.type === 'social') {
    if (item.subject.kind === 'build') {
      const r = await draftPostsForBuild(item.subject.buildId, requestedBy, db);
      return r.ok ? `post ${r.data.postId}` : `skipped: ${r.error}`;
    }
    if (item.subject.kind === 'dyno') {
      const r = await draftPostsForDynoRun(item.subject.dynoRunId, requestedBy, db);
      return r.ok ? `post ${r.data?.postId ?? 'none'}` : `skipped: ${r.error}`;
    }
    return 'covered by the recurring pillar posts';
  }
  const result = await generateAdCreative({ goal: item.goal, platform: item.platform as AdPlatform, subject: item.subject, requestedBy, extraFacts: item.extraFacts, name: item.title }, db);
  return result.ok ? `creative ${result.data.creativeId} (${result.data.generator})` : `skipped: ${result.error}`;
}

/**
 * Proposes the week and, when `execute` is set, drafts every item into the
 * approval queue and emails the owner. Nothing is published.
 */
export async function runWeeklyPlanner(options: { execute: boolean; requestedBy: string | null }, db: Db = adminDb()): Promise<{ plan: WeeklyPlan; results: { title: string; outcome: string }[] }> {
  const plan = await proposeWeeklyPlan(db);
  const results: { title: string; outcome: string }[] = [];
  if (options.execute) {
    for (const item of plan.items) results.push({ title: item.title, outcome: await executeItem(item, options.requestedBy, db) });
    const created = results.filter((r) => !r.outcome.startsWith('skipped') && !r.outcome.startsWith('covered'));
    if (created.length) {
      await sendContentMessage(db, 'content_drafts_ready', await ownerContact(db), { count: created.length, summary: created.map((r) => r.title).join('; '), admin_link: `${siteUrl()}/admin` });
    }
  }
  await recordGeneration(db, { kind: 'plan', input: { execute: options.execute }, output: { plan, results }, meta: { generator: 'demo', model: 'demo/planner', inputTokens: null, outputTokens: null, costUsd: 0, fallbackReason: null }, requestedBy: options.requestedBy });
  return { plan, results };
}
