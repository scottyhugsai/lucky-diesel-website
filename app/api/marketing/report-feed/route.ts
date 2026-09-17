import { NextResponse, type NextRequest } from 'next/server';
import { csvResponse, toCsv } from '@/lib/marketing/core/csv';
import { feedTokenHash, isFeedToken } from '@/lib/marketing/core/report-feed';
import { buildReportTable, parseReportKind } from '@/lib/marketing/core/report-export';
import { clientIp, createThrottle } from '@/lib/marketing/core/requests';
import { createAdminClient } from '@/lib/supabase/admin';

const DAY_MS = 86_400_000;
const MAX_DAYS = 400;
const throttled = createThrottle(60 * 60_000, 60);

/**
 * Read-only aggregate CSV for a BI tool (Looker Studio, Sheets). Authorised by a
 * hashed token the owner creates and can revoke. Aggregates only — no contact data.
 */
export async function GET(request: NextRequest) {
  if (throttled(clientIp(request) ?? 'unknown')) return NextResponse.json({ error: 'Slow down' }, { status: 429 });
  const token = request.nextUrl.searchParams.get('token');
  if (!isFeedToken(token)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const db = createAdminClient();
  const { data: feed } = await db.from('marketing_report_feeds').select('id, revoked_at').eq('token_hash', feedTokenHash(token)).maybeSingle();
  if (!feed || feed.revoked_at) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const kind = parseReportKind(request.nextUrl.searchParams.get('kind')) ?? 'funnel';
  const rawDays = Number(request.nextUrl.searchParams.get('days'));
  const days = Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= MAX_DAYS ? Math.floor(rawDays) : 90;
  const to = new Date();
  const from = new Date(to.getTime() - days * DAY_MS);
  try {
    const table = await buildReportTable(db, kind, from, to, request.nextUrl.searchParams.get('model'));
    await db.from('marketing_report_feeds').update({ last_used_at: to.toISOString() }).eq('id', feed.id);
    return csvResponse(toCsv(table.headers, table.rows), `lucky-diesel-${kind}.csv`);
  } catch (error) {
    console.error(`[marketing] report feed failed: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: 'Feed failed' }, { status: 500 });
  }
}
