import { NextResponse, type NextRequest } from 'next/server';
import { runCommunitySweep } from '@/lib/marketing/community/sweep';
import { runWeeklyPlanner } from '@/lib/marketing/content/planner-service';
import { runMarketingCron } from '@/lib/marketing/core/cron';
import { SHOP_TIME_ZONE } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 300;

/**
 * Vercel Cron entry point for marketing (CRON_SECRET bearer). Hobby plans run
 * crons once a day, so schedule it inside 9am–8pm Eastern, e.g. `0 15 * * *`.
 * It also runs the content engine's daily jobs and, on Mondays, the weekly planner.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const now = new Date();
  const report = await runMarketingCron(now);
  // Hobby plans allow two crons, so the content engine (posts, metrics, reviews, NPS) rides on this one.
  const content = await fetch(new URL('/api/marketing/content/cron?daily=1', request.nextUrl.origin), {
    headers: { authorization: request.headers.get('authorization') ?? '' },
    signal: AbortSignal.timeout(120_000),
  })
    .then((response) => response.json() as Promise<unknown>)
    .catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }));

  // Events, fleet reports, back-in-stock and big-cart summary. Each step is isolated inside the sweep.
  const community = await runCommunitySweep(now, createAdminClient()).catch((error: unknown) => ({
    error: error instanceof Error ? error.message : String(error),
  }));

  let planner: unknown = 'not Monday';
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: SHOP_TIME_ZONE }).format(now);
  if (weekday === 'Mon') {
    planner = await runWeeklyPlanner({ execute: true, requestedBy: null })
      .then(({ results }) => ({ drafted: results.length }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[marketing cron] weekly planner failed: ${message}`);
        return { error: message };
      });
  }
  return NextResponse.json({ ok: report.errors.length === 0, ...report, content, community, planner }, { status: report.errors.length ? 207 : 200 });
}
