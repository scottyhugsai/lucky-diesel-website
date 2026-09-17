import 'server-only';
import { resolveTxt } from 'node:dns/promises';
import { domainOf, evaluateAuthRecords, type AuthCheck } from './deliverability';

const LOOKUP_TIMEOUT_MS = 4000;

async function txt(name: string): Promise<string[]> {
  try {
    const records = await Promise.race([
      resolveTxt(name),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), LOOKUP_TIMEOUT_MS)),
    ]);
    return records.map((chunks) => chunks.join(''));
  } catch {
    return [];
  }
}

export interface SenderAuthReport {
  domain: string | null;
  checks: AuthCheck[];
  /** Resend sends from a `send.` subdomain; its SPF lives there. */
  checkedAt: string;
}

/** Live SPF, DKIM (Resend selector) and DMARC lookups for the sender email's domain. */
export async function checkSenderAuth(senderEmail: string | null | undefined): Promise<SenderAuthReport> {
  const domain = domainOf(senderEmail);
  if (!domain) return { domain: null, checks: [], checkedAt: new Date().toISOString() };
  const [rootSpf, sendSpf, dkim, dmarc] = await Promise.all([txt(domain), txt(`send.${domain}`), txt(`resend._domainkey.${domain}`), txt(`_dmarc.${domain}`)]);
  return { domain, checks: evaluateAuthRecords({ spf: [...sendSpf, ...rootSpf], dkim, dmarc }), checkedAt: new Date().toISOString() };
}
