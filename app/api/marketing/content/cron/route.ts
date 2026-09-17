import { NextResponse, type NextRequest } from 'next/server';
import { syncAdMetrics } from '@/lib/marketing/content/metrics-service';
import { autoPostPositiveReplies, tagReviewThemes } from '@/lib/marketing/content/reputation-ops';
import { requestNpsSurveys, syncGbpReviews } from '@/lib/marketing/content/reputation-service';
import { draftPillarPosts, draftPostsForBuild, draftPostsForDynoRun, publishDuePosts } from '@/lib/marketing/content/social-service';
import { adminDb } from '@/lib/marketing/content/db';

/**
 * Marketing content cron (Bearer CRON_SECRET). Every run: publish due posts.
 * ?daily=1 also: sync ad metrics + budget auto-pause, GBP reviews, NPS surveys,
 * auto-draft posts for new builds/dyno runs, the next two weeks of pillar posts,
 * review theme tags and clean 5-star auto-replies.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const summary: Record<string, unknown> = { posts: await publishDuePosts() };
  if (request.nextUrl.searchParams.get('daily') === '1') {
    const db = adminDb();
    const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const [{ data: builds }, { data: runs }] = await Promise.all([
      db.from('builds').select('id').eq('published', true).gte('created_at', since),
      db.from('dyno_runs').select('id').eq('is_baseline', false).gte('created_at', since),
    ]);
    summary.buildDrafts = await Promise.all((builds ?? []).map((b) => draftPostsForBuild(b.id, null, db)));
    summary.dynoDrafts = await Promise.all((runs ?? []).map((r) => draftPostsForDynoRun(r.id, null, db)));
    summary.pillars = await draftPillarPosts(14, null, db);
    summary.metrics = await syncAdMetrics(undefined, db);
    summary.reviews = await syncGbpReviews(db);
    summary.nps = await requestNpsSurveys(new Date(), db);
    summary.reviewThemes = await tagReviewThemes(db);
    summary.autoReplies = await autoPostPositiveReplies(new Date(), db);
  }
  return NextResponse.json({ ok: true, ...summary });
}
