import 'server-only';
import { getCatalog } from '@/lib/store/catalog';
import { siteUrl } from '@/lib/site-url';
import { canPublish } from './approvals';
import { latestApproval, loadSubject, submitForApproval } from './approvals-service';
import { pillarOccurrences, scheduleDrafts, suggestPostingTimes } from './calendar';
import { postAdapterFor } from './channels/registry';
import { adminDb, buildToRef, dynoRunToRef, fail, toJson, type Db, type Result } from './db';
import { draftBuildPost, draftProductPost, draftTipPost, type SocialDraft } from './social';
import type { SocialPlatform } from './types';

const WEEK_MS = 7 * 86_400_000;

async function upcomingSlots(db: Db): Promise<{ platform: SocialPlatform; at: Date }[]> {
  const { data } = await db.from('social_posts').select('scheduled_for, social_post_targets(platform)').gte('scheduled_for', new Date().toISOString()).not('status', 'in', '(rejected,failed)');
  return (data ?? []).flatMap((p) => p.social_post_targets.map((t) => ({ platform: t.platform as SocialPlatform, at: new Date(p.scheduled_for!) })));
}

/** Stores a draft with per-platform captions, puts it on the calendar and queues it for approval. */
async function storeDraft(db: Db, draft: SocialDraft, source: { type: 'build' | 'dyno_run' | 'product' | 'pillar'; id: string }, at: Date, requestedBy: string | null): Promise<Result<{ postId: string; created: boolean }>> {
  const { data: existing } = await db.from('social_posts').select('id').eq('source_type', source.type).eq('source_id', source.id).limit(1);
  if (existing?.[0]) return { ok: true, data: { postId: existing[0].id, created: false } };

  const { data: post, error } = await db.from('social_posts').insert({
    title: draft.title, caption: draft.caption, hashtags: draft.hashtags, link_url: `${siteUrl()}/book`, image_template: draft.imageTemplate, image_params: toJson(draft.imageParams),
    pillar: draft.pillar, source_type: source.type, source_id: source.id, scheduled_for: at.toISOString(), generator: 'demo', created_by: requestedBy,
    compliance_status: draft.complianceStatus, compliance_issues: toJson(draft.complianceIssues), needs_privacy_review: draft.needsPrivacyReview, privacy_note: draft.privacyNote,
  }).select('id').single();
  if (error || !post) return { ok: false, error: error?.message ?? 'Could not save the post.' };

  const override: Partial<Record<SocialPlatform, string>> = { gbp: draft.gbpSummary, tiktok: draft.tiktokCaption };
  const { error: targetError } = await db.from('social_post_targets').insert(draft.platforms.map((platform) => ({
    post_id: post.id, platform, caption_override: override[platform] ?? null,
    platform_options: toJson(platform === 'tiktok' ? { mode: 'inbox_draft', alternates: draft.alternates } : { alternates: draft.alternates }),
  })));
  if (targetError) return { ok: false, error: targetError.message };
  await db.from('content_calendar_items').insert({ scheduled_for: at.toISOString(), kind: 'social_post', title: draft.title, pillar: draft.pillar, ref_type: 'social_post', ref_id: post.id, status: 'drafted' });
  if (draft.complianceStatus !== 'block') {
    const queued = await submitForApproval('social_post', post.id, requestedBy, db);
    if (!queued.ok) return queued;
  }
  return { ok: true, data: { postId: post.id, created: true } };
}

async function nextSlot(db: Db, platform: SocialPlatform, notBefore = new Date()): Promise<Date> {
  const [slot] = scheduleDrafts([{ id: 'x', platform, notBefore }], new Date(), await upcomingSlots(db));
  return slot?.at ?? new Date(notBefore.getTime() + 86_400_000);
}

/** Build published → draft posts (IG/FB/GBP/TikTok) with the dyno card, queued for approval. */
export async function draftPostsForBuild(buildId: string, requestedBy: string | null = null, db: Db = adminDb()): Promise<Result<{ postId: string; created: boolean }>> {
  try {
    const { data: build } = await db.from('builds').select('*').eq('id', buildId).eq('published', true).maybeSingle();
    if (!build) return { ok: false, error: 'Only published builds get posts.' };
    const draft = draftBuildPost(buildToRef(build), 'build', `${siteUrl()}/builds/${build.slug}`);
    return await storeDraft(db, draft, { type: 'build', id: build.id }, await nextSlot(db, 'instagram'), requestedBy);
  } catch (error) {
    return fail(error);
  }
}

/** Dyno run logged → dyno-card post draft. Baseline pulls are skipped. */
export async function draftPostsForDynoRun(dynoRunId: string, requestedBy: string | null = null, db: Db = adminDb()): Promise<Result<{ postId: string; created: boolean } | null>> {
  try {
    const ref = await dynoRunToRef(db, dynoRunId);
    if (!ref?.afterHp || ref.beforeHp === null) return { ok: true, data: null };
    const draft = draftBuildPost(ref, 'dyno', `${siteUrl()}/book`);
    return await storeDraft(db, draft, { type: 'dyno_run', id: dynoRunId }, await nextSlot(db, 'instagram'), requestedBy);
  } catch (error) {
    return fail(error);
  }
}

/** Recurring pillars (build of the month, tip Tuesday, product spotlight) for the next `days`. */
export async function draftPillarPosts(days = 14, requestedBy: string | null = null, db: Db = adminDb()): Promise<Result<{ created: number }>> {
  try {
    const from = new Date();
    const occurrences = pillarOccurrences(from, new Date(from.getTime() + days * 86_400_000));
    const [{ data: builds }, catalog] = await Promise.all([db.from('builds').select('*').eq('published', true), getCatalog()]);
    const bestBuild = [...(builds ?? [])].sort((a, b) => ((b.after_hp ?? 0) - (b.before_hp ?? 0)) - ((a.after_hp ?? 0) - (a.before_hp ?? 0)))[0];
    const products = catalog.products.filter((p) => p.available && !p.offRoadOnly && ['turbo', 'fuel', 'exhaust'].includes(p.category));
    let created = 0;
    for (const { pillar, at } of occurrences) {
      const week = Math.floor(at.getTime() / WEEK_MS);
      const sourceId = `${pillar}:${at.toISOString().slice(0, 10)}`;
      let draft: SocialDraft | null = null;
      if (pillar === 'tip_tuesday') draft = draftTipPost(week, `${siteUrl()}/book`);
      if (pillar === 'build_of_the_month' && bestBuild) draft = { ...draftBuildPost(buildToRef(bestBuild), 'build', `${siteUrl()}/builds/${bestBuild.slug}`), pillar, title: `Build of the month: ${bestBuild.title}` };
      if (pillar === 'product_spotlight' && products.length) {
        const p = products[week % products.length]!;
        draft = draftProductPost({ handle: p.handle, title: p.title, vendor: p.vendor, category: p.category, priceFromCents: p.priceMinCents, image: p.images[0]?.src ?? null, platforms: p.platforms, offRoadOnly: p.offRoadOnly }, `${siteUrl()}/store/products/${p.handle}`);
      }
      if (!draft) continue;
      const stored = await storeDraft(db, draft, { type: 'pillar', id: sourceId }, at, requestedBy);
      if (!stored.ok) return stored;
      if (stored.data.created) created += 1;
    }
    return { ok: true, data: { created } };
  } catch (error) {
    return fail(error);
  }
}

/** Posting-time suggestions that avoid what's already on the calendar. */
export async function suggestTimes(platform: SocialPlatform, count = 3, db: Db = adminDb()): Promise<Date[]> {
  const taken = (await upcomingSlots(db)).filter((s) => s.platform === platform).map((s) => s.at);
  return suggestPostingTimes(platform, new Date(), count, taken);
}

/** Publishes (or simulates) an approved post to each target platform. */
export async function publishSocialPost(postId: string, db: Db = adminDb()): Promise<Result<{ results: { platform: string; status: string }[] }>> {
  try {
    const snapshot = await loadSubject(db, 'social_post', postId);
    const approval = await latestApproval(db, 'social_post', postId);
    if (!snapshot) return { ok: false, error: 'Post not found.' };
    const gate = canPublish({ status: snapshot.status, approval, payload: snapshot.payload, compliance: snapshot.compliance, warningsAcknowledged: approval?.warningsAcknowledged ?? false });
    if (!gate.ok) return { ok: false, error: gate.reason };
    const { data: post } = await db.from('social_posts').select('*, social_post_targets(*)').eq('id', postId).single();
    if (!post) return { ok: false, error: 'Post not found.' };
    if (post.needs_privacy_review && !approval?.warningsAcknowledged) return { ok: false, error: 'Confirm plates, VINs and faces are blurred before posting this photo.' };

    const imageUrl = post.image_template ? `${siteUrl()}/api/marketing/creative/${post.id}/image` : null;
    const results: { platform: string; status: string }[] = [];
    for (const target of post.social_post_targets) {
      if (['published', 'simulated', 'draft_handoff'].includes(target.status)) continue;
      const platform = target.platform as SocialPlatform;
      try {
        const { adapter, connection } = await postAdapterFor(platform, db);
        const caption = `${target.caption_override ?? post.caption}${platform === 'gbp' || !post.hashtags.length ? '' : `\n\n${post.hashtags.join(' ')}`}`;
        const result = await adapter.publish({ postId: post.id, platform, caption, imageUrl, linkUrl: post.link_url, scheduledFor: post.scheduled_for ? new Date(post.scheduled_for) : null, options: (target.platform_options ?? {}) as Record<string, unknown> });
        await db.from('social_post_targets').update({ status: result.status, simulated: result.simulated, external_id: result.externalId, permalink: result.permalink, published_at: new Date().toISOString(), connection_id: connection.id, attempts: target.attempts + 1, error: null }).eq('id', target.id);
        results.push({ platform, status: result.status });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db.from('social_post_targets').update({ status: 'failed', error: message, attempts: target.attempts + 1 }).eq('id', target.id);
        results.push({ platform, status: `failed: ${message}` });
      }
    }
    const failed = results.some((r) => r.status.startsWith('failed'));
    await db.from('social_posts').update({ status: failed ? 'failed' : 'published', published_at: new Date().toISOString() }).eq('id', postId);
    await db.from('content_calendar_items').update({ status: failed ? 'skipped' : 'done' }).eq('ref_type', 'social_post').eq('ref_id', postId);
    return { ok: true, data: { results } };
  } catch (error) {
    return fail(error);
  }
}

/** Cron: every approved or scheduled post whose time has come. */
export async function publishDuePosts(now = new Date(), db: Db = adminDb()): Promise<{ attempted: number; errors: string[] }> {
  const { data } = await db.from('social_posts').select('id').in('status', ['approved', 'scheduled']).lte('scheduled_for', now.toISOString()).limit(25);
  const errors: string[] = [];
  for (const post of data ?? []) {
    const result = await publishSocialPost(post.id, db);
    if (!result.ok) errors.push(`${post.id}: ${result.error}`);
  }
  return { attempted: data?.length ?? 0, errors };
}
