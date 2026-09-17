/**
 * Email checks at capture and import: syntax, common domain typos, and whether
 * the domain can receive mail (MX lookup). Lookups fail open: a slow or broken
 * DNS answer never blocks a real customer. Server only (node:dns).
 */

import { resolve4, resolveMx } from 'node:dns/promises';
import { EMAIL_SYNTAX, suggestEmailFix } from './email-typo';

export { EMAIL_SYNTAX, suggestEmailFix };

export type DomainStatus = 'ok' | 'dead' | 'unknown';

const LOOKUP_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

const isMissing = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  return code === 'ENOTFOUND' || code === 'ENODATA' || code === 'NXDOMAIN';
};

/** Whether a domain can receive mail: MX first, then an A record (RFC 5321 fallback). */
export async function checkEmailDomain(domain: string, timeoutMs = LOOKUP_TIMEOUT_MS): Promise<DomainStatus> {
  const clean = domain.trim().toLowerCase();
  if (!/^[a-z0-9.-]{3,190}\.[a-z]{2,}$/.test(clean)) return 'dead';
  try {
    const mx = await withTimeout(resolveMx(clean), timeoutMs);
    if (mx.some((r) => r.exchange && r.exchange !== '.')) return 'ok';
    return 'dead'; // Null MX (RFC 7505): the domain accepts no mail.
  } catch (error) {
    if (!isMissing(error)) return 'unknown';
  }
  try {
    const a = await withTimeout(resolve4(clean), timeoutMs);
    return a.length ? 'ok' : 'dead';
  } catch (error) {
    return isMissing(error) ? 'dead' : 'unknown';
  }
}

export type EmailCheck = { ok: true } | { ok: false; error: string; suggestion: string | null };

/** Full check for one address. Rejects bad syntax and dead domains; a typo alone only adds a hint. */
export async function checkEmail(email: string, lookup: (domain: string) => Promise<DomainStatus> = checkEmailDomain): Promise<EmailCheck> {
  const value = email.trim().toLowerCase();
  const suggestion = suggestEmailFix(value);
  if (!EMAIL_SYNTAX.test(value)) return { ok: false, error: 'Enter a valid email.', suggestion };
  const status = await lookup(value.slice(value.lastIndexOf('@') + 1));
  if (status === 'dead') {
    return { ok: false, error: suggestion ? `That email can't get mail. Did you mean ${suggestion}?` : "That email domain can't get mail.", suggestion };
  }
  return { ok: true };
}
