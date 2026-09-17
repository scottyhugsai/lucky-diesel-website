import { NextResponse } from 'next/server';
import { CHAT_COOKIE, CHAT_COOKIE_MAX_AGE, parseStart, postVisitorMessage, readThread, startThread } from '@/lib/marketing/engage/chat';
import { clientIp, createThrottle, readCookie } from '@/lib/marketing/core/requests';

const throttledPost = createThrottle(10 * 60_000, 30);
const throttledStart = createThrottle(60 * 60_000, 5);
const throttledPoll = createThrottle(60_000, 40);

/** Web chat poll: the thread is found only by the visitor's own httpOnly cookie. */
export async function GET(request: Request) {
  if (throttledPoll(clientIp(request) ?? 'unknown')) return NextResponse.json({ thread: null }, { status: 429 });
  const thread = await readThread(readCookie(request, CHAT_COOKIE));
  return NextResponse.json({ thread }, { headers: { 'Cache-Control': 'private, no-store' } });
}

/** `{ action: 'start', name, email?, phone?, smsConsent, message, pageUrl }` or `{ action: 'send', message }`. */
export async function POST(request: Request) {
  const ip = clientIp(request) ?? 'unknown';
  if (throttledPost(ip)) return NextResponse.json({ ok: false, error: 'Too many messages. Call or text us.' }, { status: 429 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });

  if (body.action === 'send') {
    const result = await postVisitorMessage(readCookie(request, CHAT_COOKIE), body.message);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  }
  if (body.action !== 'start') return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  if (typeof body.company === 'string' && body.company) return NextResponse.json({ ok: true });
  if (throttledStart(ip)) return NextResponse.json({ ok: false, error: 'Too many chats. Call or text us.' }, { status: 429 });
  const parsed = parseStart(body);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 422 });
  try {
    const { token } = await startThread(parsed.value);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(CHAT_COOKIE, token, {
      httpOnly: true, sameSite: 'lax', secure: new URL(request.url).protocol === 'https:', path: '/api/marketing/chat', maxAge: CHAT_COOKIE_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error(`[engage] ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ ok: false, error: 'Chat is down. Call or text us.' }, { status: 500 });
  }
}
