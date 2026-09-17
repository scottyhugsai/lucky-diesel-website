import { NextResponse } from 'next/server';
import { attributeConversion, recordTouch } from '@/lib/marketing/core/attribution';
import { ATTRIBUTION_COOKIE, decodeAttributionCookie, parseTouch } from '@/lib/marketing/core/attribution-touch';
import { clientIp, createThrottle, readCookie } from '@/lib/marketing/core/requests';
import { recordEngagementEvent } from '@/lib/marketing/engage/track';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';

const throttled = createThrottle(60_000, 60);
const EVENTS = new Set(['pageview', 'store_checkout_click']);
const ENGAGE_EVENTS = new Set(['ab_exposure', 'ab_conversion', 'popup_view', 'popup_click', 'consent']);

/**
 * First-party tracking beacon. Body: `{ event: 'pageview' | 'store_checkout_click', url?: string, referrer?: string, value_cents?: number }`.
 * Engagement events (A/B, popups, cookie consent) are handled in lib/marketing/engage/track.ts.
 * Identity comes only from the `ld_attr` cookie set by the proxy.
 */
export async function POST(request: Request) {
  if (throttled(clientIp(request) ?? 'unknown')) return NextResponse.json({ ok: false }, { status: 429 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ ok: false }, { status: 400 });
  const { event, url, referrer, value_cents: valueCents } = body as Record<string, unknown>;
  if (typeof event !== 'string' || (!EVENTS.has(event) && !ENGAGE_EVENTS.has(event))) return NextResponse.json({ ok: false, error: 'unknown event' }, { status: 400 });

  const rawCookie = readCookie(request, ATTRIBUTION_COOKIE);
  const cookie = decodeAttributionCookie(rawCookie);
  if (!cookie) return NextResponse.json({ ok: true, tracked: false });

  const db = createAdminClient();
  const now = new Date();
  if (ENGAGE_EVENTS.has(event)) {
    const tracked = await recordEngagementEvent(db, event, body as Record<string, unknown>, cookie.aid);
    return NextResponse.json({ ok: true, tracked });
  }
  const { data: visitor } = await db.from('tracking_visitors')
    .upsert({ anonymous_id: cookie.aid, last_seen_at: now.toISOString(), user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null }, { onConflict: 'anonymous_id' })
    .select('customer_id')
    .single();

  if (event === 'pageview' && typeof url === 'string' && url.length < 2000) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(url, siteUrl());
    } catch {
      parsed = null;
    }
    const touch = parsed ? parseTouch(parsed, typeof referrer === 'string' ? referrer.slice(0, 500) : null, now, new URL(siteUrl()).hostname) : null;
    if (touch) await recordTouch({ touch, anonymousId: cookie.aid, customerId: visitor?.customer_id ?? null }, db);
    return NextResponse.json({ ok: true, tracked: Boolean(touch) });
  }

  const cents = typeof valueCents === 'number' && Number.isFinite(valueCents) ? Math.max(0, Math.min(10_000_000, Math.round(valueCents))) : 0;
  await attributeConversion({
    kind: 'store_checkout_click', customerId: visitor?.customer_id ?? null, cookie: rawCookie, valueCents: cents, occurredAt: now,
    eventId: `${cookie.aid}:${Math.floor(now.getTime() / 60_000)}`,
  }, db);
  return NextResponse.json({ ok: true, tracked: true });
}
