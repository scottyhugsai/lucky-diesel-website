import { createHash } from 'node:crypto';

/** Report-feed tokens are stored hashed; the plaintext is shown once at creation. */
export function feedTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Feed tokens are 24 random bytes, base64url. */
export function isFeedToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32}$/.test(value);
}
