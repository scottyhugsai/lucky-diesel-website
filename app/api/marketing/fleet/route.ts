import { NextResponse } from 'next/server';
import { inquiryRow, parseFleetInquiry } from '@/lib/marketing/fleet/fleet-inquiry';
import { clientIp, createThrottle } from '@/lib/marketing/core/requests';
import { createAdminClient } from '@/lib/supabase/admin';

const throttled = createThrottle(10 * 60_000, 5);

/**
 * Public fleet inquiry. Answers the same way whether or not the company is
 * already on file, so the endpoint can't be used to probe the customer list.
 */
export async function POST(request: Request) {
  if (throttled(clientIp(request) ?? 'unknown')) {
    return NextResponse.json({ ok: false, error: 'Too many requests.' }, { status: 429 });
  }
  const parsed = parseFleetInquiry(await request.json().catch(() => null));
  if (!parsed.ok) {
    if (parsed.spam) return NextResponse.json({ ok: true });
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 422 });
  }

  const db = createAdminClient();
  const { data: existing } = await db.from('fleet_accounts').select('id').ilike('name', parsed.value.name).limit(1).maybeSingle();
  if (existing) return NextResponse.json({ ok: true });

  const { error } = await db.from('fleet_accounts').insert(inquiryRow(parsed.value));
  if (error) {
    console.error(`[fleet] inquiry insert failed: ${error.message}`);
    return NextResponse.json({ ok: false, error: 'Couldn’t send. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
