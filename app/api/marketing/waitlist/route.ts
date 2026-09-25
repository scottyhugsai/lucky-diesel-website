import { NextResponse } from 'next/server';
import { clientIp } from '@/lib/marketing/core/requests';
import { overRateLimit } from '@/lib/marketing/core/rate-limit';
import { joinWaitlist, parseWaitlist } from '@/lib/marketing/engage/waitlist';


/** "Notify me" sign-up. Always answers the same way whether or not the email was already on the list. */
export async function POST(request: Request) {
  if (await overRateLimit('waitlist', clientIp(request) ?? 'unknown')) return NextResponse.json({ ok: false, error: 'Too many requests.' }, { status: 429 });
  const parsed = parseWaitlist(await request.json().catch(() => null));
  if (!parsed.ok) return parsed.spam ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: parsed.error }, { status: 422 });
  const ok = await joinWaitlist(parsed.value);
  return NextResponse.json(ok ? { ok: true } : { ok: false, error: 'Couldn’t save. Try again.' }, { status: ok ? 200 : 500 });
}
