import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { readJson, requireAdmin } from '@/lib/marketing/content/http';
import { runWeeklyPlanner } from '@/lib/marketing/content/planner-service';

/** POST { execute?: boolean } — propose this week's ads + posts; execute drafts them into the approval queue. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('response' in auth) return auth.response;
  const body = await readJson(request);
  try {
    return NextResponse.json({ ok: true, data: await runWeeklyPlanner({ execute: body?.execute === true, requestedBy: auth.viewer.userId }) });
  } catch (error) {
    console.error(`[marketing/plan] ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ ok: false, error: 'Could not build the plan.' }, { status: 500 });
  }
}
