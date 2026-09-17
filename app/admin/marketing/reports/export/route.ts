import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/lib/auth';
import { csvResponse, toCsv } from '@/lib/marketing/core/csv';
import { buildReportTable, parseReportKind } from '@/lib/marketing/core/report-export';
import { createAdminClient } from '@/lib/supabase/admin';

const DAY_MS = 86_400_000;
const MAX_DAYS = 400;

/** Admin CSV downloads for the funnel, the daily series and campaign results. */
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer || viewer.profile.role !== 'admin') return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const kind = parseReportKind(request.nextUrl.searchParams.get('kind'));
  if (!kind) return NextResponse.json({ error: 'Unknown export' }, { status: 400 });

  const rawDays = Number(request.nextUrl.searchParams.get('days'));
  const days = Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= MAX_DAYS ? Math.floor(rawDays) : 90;
  const to = new Date();
  const from = new Date(to.getTime() - days * DAY_MS);
  try {
    const table = await buildReportTable(createAdminClient(), kind, from, to, request.nextUrl.searchParams.get('model'));
    return csvResponse(toCsv(table.headers, table.rows), `lucky-diesel-${kind}-${to.toISOString().slice(0, 10)}.csv`);
  } catch (error) {
    console.error(`[marketing] report export failed: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
