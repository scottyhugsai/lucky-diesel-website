import { NextResponse, type NextRequest } from 'next/server';
import { runMarketingCron } from '@/lib/marketing/core/cron';

export const maxDuration = 300;

/**
 * Vercel Cron entry point for marketing (CRON_SECRET bearer). Hobby plans run
 * crons once a day, so schedule it inside 9am–8pm Eastern, e.g. `0 15 * * *`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const report = await runMarketingCron(new Date());
  return NextResponse.json({ ok: report.errors.length === 0, ...report }, { status: report.errors.length ? 207 : 200 });
}
