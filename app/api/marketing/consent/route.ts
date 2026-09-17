import { NextResponse } from 'next/server';
import { captureConsent, parseConsentCapture } from '@/lib/marketing/core/consent-capture';
import { clientIp, createThrottle } from '@/lib/marketing/core/requests';

const throttled = createThrottle(10 * 60_000, 10);

/**
 * Public consent capture (newsletter / SMS club forms). The unchecked-by-default
 * checkbox text version, IP, user agent and page URL are stored as evidence.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (throttled(ip ?? 'unknown')) return NextResponse.json({ ok: false, error: 'Too many requests.' }, { status: 429 });
  const parsed = parseConsentCapture(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 422 });

  const result = await captureConsent(parsed.value, { ip, userAgent: request.headers.get('user-agent') }).catch((error: unknown) => {
    console.error(`[marketing] consent capture failed: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false as const, error: 'Could not save your preference.', status: 500 };
  });
  // Don't reveal whether an address is already a customer.
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: result.error }, { status: result.status });
}
