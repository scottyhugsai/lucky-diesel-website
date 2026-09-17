/**
 * Pre-send deliverability checks (spam signals, risky links), sender formatting
 * and email-auth record evaluation. Pure.
 */

export interface DeliverabilityIssue {
  severity: 'block' | 'warn';
  rule: string;
  message: string;
}

const SPAM_PHRASES = [
  'act now', 'buy now', 'cash bonus', 'click here', 'double your', 'earn money', 'free money', 'get paid', 'guaranteed winner', 'increase sales',
  'limited time only', 'no catch', 'no cost', 'no obligation', 'once in a lifetime', 'risk free', 'risk-free', 'this is not spam', 'urgent', 'winner',
  'you have been selected', '100% free', 'order now', 'call now', 'lowest price',
];
const SHORTENERS = /\b(?:bit\.ly|tinyurl\.com|goo\.gl|t\.co|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|tiny\.cc)\//i;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
const PLACEHOLDER = /\{\{\s*[a-z_]+\s*\}\}/gi;

export function extractUrls(text: string): string[] {
  return [...new Set([...(text ?? '').matchAll(URL_PATTERN)].map((m) => m[0].replace(/[.,;:!?]+$/, '')))];
}

function capsRatio(text: string): number {
  const words = text.replace(PLACEHOLDER, '').match(/\b[A-Za-z]{3,}\b/g) ?? [];
  if (words.length < 5) return 0;
  return words.filter((w) => w === w.toUpperCase()).length / words.length;
}

export interface DeliverabilityInput {
  channel: 'email' | 'sms';
  subject?: string | null;
  body: string;
  /** Extra copy (blocks) and image alt coverage. */
  extraText?: string;
  imagesMissingAlt?: number;
  linkCount?: number;
}

/** Spam words, shouting, `!!!`, public shorteners, insecure links, alt text and subject length. */
export function checkDeliverability(input: DeliverabilityInput): DeliverabilityIssue[] {
  const issues: DeliverabilityIssue[] = [];
  const all = [input.subject ?? '', input.body, input.extraText ?? ''].join('\n');
  const lower = all.toLowerCase();

  const phrases = SPAM_PHRASES.filter((p) => lower.includes(p));
  if (phrases.length) issues.push({ severity: 'warn', rule: 'spam_words', message: `Spam-filter words: ${phrases.slice(0, 4).map((p) => `“${p}”`).join(', ')}.` });
  if (capsRatio(all) > 0.3) issues.push({ severity: 'warn', rule: 'all_caps', message: 'Too much ALL CAPS. Filters read it as shouting.' });
  if (input.subject && input.subject.length >= 8 && input.subject === input.subject.toUpperCase() && /[A-Z]/.test(input.subject)) {
    issues.push({ severity: 'warn', rule: 'caps_subject', message: 'Subject is all caps.' });
  }
  if (/!{2,}/.test(all) || (all.match(/!/g)?.length ?? 0) > 3) issues.push({ severity: 'warn', rule: 'exclamation', message: 'Cut back on exclamation marks.' });
  if (/\${2,}|\$\s?\$/.test(all)) issues.push({ severity: 'warn', rule: 'money_symbols', message: 'Avoid “$$$”.' });

  const urls = extractUrls(all);
  if (urls.some((u) => SHORTENERS.test(u))) {
    issues.push({ severity: input.channel === 'sms' ? 'block' : 'warn', rule: 'public_shortener', message: 'Public link shorteners get filtered. Use {{link}} (branded link).' });
  }
  if (urls.some((u) => u.toLowerCase().startsWith('http://'))) issues.push({ severity: 'warn', rule: 'insecure_link', message: 'Use https:// links.' });
  const links = (input.linkCount ?? 0) + urls.length + (all.match(/\{\{\s*(?:link|booking_link|referral_link|portal_link)\s*\}\}/gi)?.length ?? 0);
  if (input.channel === 'sms' && links > 1) issues.push({ severity: 'warn', rule: 'sms_links', message: 'Texts with more than one link get filtered more.' });
  if (input.channel === 'email' && links > 8) issues.push({ severity: 'warn', rule: 'email_links', message: 'Lots of links. Keep it under 8.' });
  if (input.imagesMissingAlt) issues.push({ severity: 'warn', rule: 'image_alt', message: `${input.imagesMissingAlt} image${input.imagesMissingAlt === 1 ? '' : 's'} missing alt text.` });
  if (input.channel === 'email' && input.subject && input.subject.length > 70) issues.push({ severity: 'warn', rule: 'long_subject', message: 'Subject gets cut off past ~60 characters.' });
  return issues;
}

/** RFC 5322 display name + address. Strips characters that could inject headers. */
export function formatSender(name: string | null | undefined, email: string | null | undefined, fallback: string): string {
  const cleanName = (name ?? '').replace(/[\r\n"<>\\,;]/g, '').trim().slice(0, 80);
  const fallbackAddress = /<([^<>\s]+@[^<>\s]+)>/.exec(fallback)?.[1] ?? (/^[^\s@<>]+@[^\s@<>]+$/.test(fallback.trim()) ? fallback.trim() : null);
  const address = email && /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(email.trim()) ? email.trim() : fallbackAddress;
  if (!address) return fallback;
  return cleanName ? `${cleanName} <${address}>` : address;
}

export function domainOf(email: string | null | undefined): string | null {
  const domain = email?.split('@')[1]?.trim().toLowerCase();
  return domain && /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain) ? domain : null;
}

export type AuthState = 'pass' | 'warn' | 'missing';

export interface AuthCheck {
  key: 'spf' | 'dkim' | 'dmarc';
  label: string;
  state: AuthState;
  detail: string;
}

/** Grades TXT records for the sending domain. `dkim` is the Resend selector record. */
export function evaluateAuthRecords(records: { spf: string[]; dkim: string[]; dmarc: string[] }): AuthCheck[] {
  const spf = records.spf.find((r) => /^v=spf1\b/i.test(r));
  const dmarc = records.dmarc.find((r) => /^v=DMARC1\b/i.test(r));
  const policy = dmarc ? /\bp=(none|quarantine|reject)\b/i.exec(dmarc)?.[1]?.toLowerCase() ?? null : null;
  const dkim = records.dkim.find((r) => /\bp=[A-Za-z0-9+/]{40,}/.test(r.replace(/\s/g, '')));
  return [
    {
      key: 'spf', label: 'SPF',
      state: !spf ? 'missing' : /include:(?:amazonses\.com|_spf\.resend\.com)/i.test(spf) ? 'pass' : 'warn',
      detail: !spf ? 'Add the SPF record Resend gives you.' : /include:(?:amazonses\.com|_spf\.resend\.com)/i.test(spf) ? 'Found.' : 'Found, but it does not include Resend.',
    },
    { key: 'dkim', label: 'DKIM', state: dkim ? 'pass' : 'missing', detail: dkim ? 'Found.' : 'Add the resend._domainkey record.' },
    {
      key: 'dmarc', label: 'DMARC',
      state: !dmarc ? 'missing' : policy === 'none' || !policy ? 'warn' : 'pass',
      detail: !dmarc ? 'Add _dmarc with p=none to start.' : policy === 'none' ? 'Monitoring only (p=none).' : `Policy ${policy}.`,
    },
  ];
}
