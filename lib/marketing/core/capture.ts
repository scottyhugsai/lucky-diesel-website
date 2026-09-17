import type { NextRequest, NextResponse } from 'next/server';
import {
  ATTRIBUTION_COOKIE, ATTRIBUTION_MAX_AGE_SECONDS, decodeAttributionCookie, encodeAttributionCookie, nextAttribution, parseTouch,
} from './attribution-touch';

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|lighthouse/i;

/**
 * Proxy step for public pages: gives each browser an anonymous id and stores
 * first/last touch (UTMs, gclid/gbraid/wbraid, fbclid, ttclid, msclkid, ?ref,
 * external referrer) in a first-party cookie. Only writes when something changed.
 */
export function captureAttribution(request: NextRequest, response: NextResponse, now = new Date()): void {
  if (request.method !== 'GET' || request.headers.has('next-router-prefetch') || request.headers.get('purpose') === 'prefetch') return;
  if (BOT.test(request.headers.get('user-agent') ?? '')) return;

  const raw = request.cookies.get(ATTRIBUTION_COOKIE)?.value;
  const existing = decodeAttributionCookie(raw);
  const touch = parseTouch(request.nextUrl, request.headers.get('referer'), now, request.nextUrl.hostname);
  if (existing && !touch) return;

  const next = nextAttribution(existing, touch, () => crypto.randomUUID().replace(/-/g, ''));
  response.cookies.set(ATTRIBUTION_COOKIE, encodeAttributionCookie(next), {
    maxAge: ATTRIBUTION_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
  });
}
