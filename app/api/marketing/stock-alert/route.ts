import { NextResponse } from 'next/server';
import { clientIp, createThrottle } from '@/lib/marketing/core/requests';
import { parseStockAlert } from '@/lib/store/stock-alert-request';
import { joinStockAlert } from '@/lib/store/stock-alerts';
import { createAdminClient } from '@/lib/supabase/admin';

const throttled = createThrottle(10 * 60_000, 10);

/** Back-in-stock request. Always answers the same way whether or not the email was already waiting. */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (throttled(ip ?? 'unknown')) return NextResponse.json({ ok: false, error: 'Too many requests.' }, { status: 429 });
  const parsed = parseStockAlert(await request.json().catch(() => null));
  if (!parsed.ok) return parsed.spam ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: parsed.error }, { status: 422 });
  const ok = await joinStockAlert(createAdminClient(), parsed.value, ip);
  return NextResponse.json(ok ? { ok: true } : { ok: false, error: 'Couldn’t save. Try again.' }, { status: ok ? 200 : 500 });
}
