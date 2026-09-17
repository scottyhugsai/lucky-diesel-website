import { NextResponse, type NextRequest } from 'next/server';
import { ATTRIBUTION_MAX_AGE_SECONDS, REFERRAL_COOKIE } from '@/lib/marketing/core/attribution-touch';
import { lookupAnyReferralCode, normalizeReferralCode } from '@/lib/marketing/core/referrals';
import { clientIp, createThrottle } from '@/lib/marketing/core/requests';
import { siteUrl } from '@/lib/site-url';

const throttled = createThrottle(60_000, 30);

/**
 * Referral landing: `/api/marketing/referral?code=CODY-7KQ2`. Validates the code,
 * remembers it in a first-party cookie for the lead/booking forms, and sends the
 * visitor to booking with `?ref=` so the proxy records a referral touch.
 */
export async function GET(request: NextRequest) {
  const code = normalizeReferralCode(request.nextUrl.searchParams.get('code'));
  const destination = new URL('/book', siteUrl());
  if (!code || throttled(clientIp(request) ?? 'unknown')) return NextResponse.redirect(destination, 302);

  const valid = await lookupAnyReferralCode(code).catch(() => null);
  if (!valid) return NextResponse.redirect(destination, 302);
  destination.searchParams.set('ref', code);
  destination.searchParams.set('utm_source', 'referral');
  destination.searchParams.set('utm_medium', 'referral');
  const response = NextResponse.redirect(destination, 302);
  response.cookies.set(REFERRAL_COOKIE, code, { maxAge: ATTRIBUTION_MAX_AGE_SECONDS, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  return response;
}
