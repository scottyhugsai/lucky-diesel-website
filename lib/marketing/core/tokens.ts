import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Short HMAC-signed tokens for public links (unsubscribe, click tracking).
 * Secret: MARKETING_SIGNING_SECRET, else CRON_SECRET, else the service role key
 * (all server-only). Tokens are scoped by `purpose` so one can't be replayed as another.
 */

export type TokenPurpose = 'unsubscribe' | 'click' | 'open';

function secret(): string {
  const value = process.env.MARKETING_SIGNING_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error('No signing secret configured (set MARKETING_SIGNING_SECRET)');
  return value;
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function mac(purpose: TokenPurpose, data: string): string {
  return createHmac('sha256', secret()).update(`${purpose}.${data}`).digest('base64url').slice(0, 32);
}

export function signToken(purpose: TokenPurpose, payload: Record<string, string>): string {
  const data = toBase64Url(JSON.stringify(payload));
  return `${data}.${mac(purpose, data)}`;
}

export function verifyToken(purpose: TokenPurpose, token: string | null | undefined): Record<string, string> | null {
  if (!token || token.length > 2048) return null;
  const [data, signature, extra] = token.split('.');
  if (!data || !signature || extra !== undefined) return null;
  const expected = Buffer.from(mac(purpose, data));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
    return Object.fromEntries(entries);
  } catch {
    return null;
  }
}

/**
 * Twilio request signature: base64(HMAC-SHA1(authToken, url + sorted key/value pairs)).
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac('sha1', authToken).update(payload).digest('base64');
}

export function isValidTwilioSignature(authToken: string, url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!signature) return false;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Minimal TwiML reply. Message text is XML-escaped. */
export function twiml(message?: string): string {
  if (!message) return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}
