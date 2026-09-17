import 'server-only';
import { isValidTwilioSignature } from './tokens';

/** Best-effort per-instance limiter for public endpoints (same approach as /api/lead). */
export function createThrottle(windowMs: number, max: number): (key: string, now?: number) => boolean {
  const hits = new Map<string, number[]>();
  return (key, now = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    hits.set(key, [...recent, now]);
    if (hits.size > 5000) hits.clear();
    return recent.length >= max;
  };
}

export function clientIp(request: Request): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export interface TwilioRequest {
  params: Record<string, string>;
  valid: boolean;
  reason?: string;
}

/**
 * Parses a Twilio webhook form post and validates `X-Twilio-Signature`.
 * Without TWILIO_AUTH_TOKEN, requests are accepted only in demo mode with
 * simulated SMS, so the flow can be exercised locally with curl.
 */
export async function readTwilioRequest(request: Request): Promise<TwilioRequest> {
  const text = await request.text();
  if (text.length > 20_000) return { params: {}, valid: false, reason: 'payload too large' };
  const params = Object.fromEntries(new URLSearchParams(text).entries());
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!token) {
    const demo = process.env.DEMO_MODE === 'true' && process.env.MESSAGING_SMS_MODE !== 'live';
    return { params, valid: demo, reason: demo ? undefined : 'TWILIO_AUTH_TOKEN not configured' };
  }
  const url = new URL(request.url);
  const base = process.env.TWILIO_WEBHOOK_BASE_URL?.trim().replace(/\/$/, '');
  const signedUrl = base ? `${base}${url.pathname}${url.search}` : url.toString();
  const valid = isValidTwilioSignature(token, signedUrl, params, request.headers.get('x-twilio-signature'));
  return { params, valid, reason: valid ? undefined : 'invalid signature' };
}
