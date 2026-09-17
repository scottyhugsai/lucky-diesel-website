import { NextResponse } from 'next/server';
import { parsePartial, savePartial } from '@/lib/marketing/engage/partial';
import { clientIp, createThrottle } from '@/lib/marketing/core/requests';

const throttled = createThrottle(10 * 60_000, 20);

/** Quote form step 1 autosave: keeps the contact so an unfinished form isn't lost. */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (throttled(ip ?? 'unknown')) return NextResponse.json({ ok: false }, { status: 429 });
  const parsed = parsePartial(await request.json().catch(() => null));
  if (!parsed.ok) return parsed.spam ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: parsed.error }, { status: 422 });
  const saved = await savePartial(parsed.value, { ip, userAgent: request.headers.get('user-agent') }).catch(() => ({ ok: false }));
  return NextResponse.json({ ok: saved.ok }, { status: saved.ok ? 200 : 500 });
}
