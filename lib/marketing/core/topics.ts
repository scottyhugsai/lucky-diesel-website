/** Email topics for the preference center, SMS keywords and engagement sunset rules. Pure. */

export const EMAIL_TOPICS = [
  { key: 'newsletter', label: 'Monthly newsletter' },
  { key: 'offers', label: 'Deals and coupons' },
  { key: 'events', label: 'Dyno days and events' },
  { key: 'service', label: 'Service tips' },
] as const;
export type EmailTopic = (typeof EMAIL_TOPICS)[number]['key'];

export function isEmailTopic(value: unknown): value is EmailTopic {
  return typeof value === 'string' && EMAIL_TOPICS.some((t) => t.key === value);
}

/** A campaign without a topic goes to every subscriber. */
export function isTopicAllowed(topicsOff: readonly string[] | null | undefined, topic: string | null | undefined): boolean {
  return !topic || !(topicsOff ?? []).includes(topic);
}

// ─── SMS keywords ───────────────────────────────────────────────────────────

export interface SmsKeyword {
  id: string;
  keyword: string;
  action: 'reply' | 'opt_in';
  reply: string;
  active: boolean;
}

/** Carrier keywords are handled by the STOP/START/HELP path and can't be reused. */
export const RESERVED_KEYWORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT', 'REVOKE', 'START', 'UNSTOP', 'SUBSCRIBE', 'OPTIN', 'YES', 'HELP', 'INFO']);

export function normalizeKeyword(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Exact single-word match (case, spacing and punctuation ignored). */
export function matchKeyword<T extends Pick<SmsKeyword, 'keyword' | 'active'>>(body: string, keywords: readonly T[]): T | null {
  const words = body.trim().split(/\s+/);
  if (words.length > 2) return null;
  const word = normalizeKeyword(body);
  if (!word) return null;
  return keywords.find((k) => k.active && k.keyword === word) ?? null;
}

/** CTIA opt-in confirmation: brand, HELP and STOP must appear. */
export function ensureOptInReply(reply: string, businessName: string): string {
  let text = reply.trim();
  if (!text.toLowerCase().includes(businessName.toLowerCase())) text = `${businessName}: ${text}`;
  if (!/msg\s*&\s*data rates/i.test(text)) text = `${text} Msg & data rates may apply.`;
  if (!/\bhelp\b/i.test(text)) text = `${text} Reply HELP for help.`;
  if (!/\bstop\b/i.test(text)) text = `${text} Reply STOP to cancel.`;
  return text;
}

// ─── Engagement sunset ──────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
export const SUNSET_GRACE_DAYS = 14;

export interface SunsetFacts {
  /** First marketing email we sent them. */
  firstMailedAt: Date | null;
  /** Latest open, click, booking, visit or reply. */
  lastEngagedAt: Date | null;
  noticeAt: Date | null;
}

/**
 * `notice`: send the "still want these?" email. `suppress`: no response after the
 * grace period. `reset`: they engaged after a notice. `none`: nothing to do.
 */
export function sunsetStep(facts: SunsetFacts, now: Date, days: number): 'none' | 'notice' | 'suppress' | 'reset' {
  if (days <= 0 || !facts.firstMailedAt) return 'none';
  if (facts.noticeAt) {
    if (facts.lastEngagedAt && facts.lastEngagedAt > facts.noticeAt) return 'reset';
    return now.getTime() - facts.noticeAt.getTime() >= SUNSET_GRACE_DAYS * DAY_MS ? 'suppress' : 'none';
  }
  const cutoff = now.getTime() - days * DAY_MS;
  if (facts.firstMailedAt.getTime() > cutoff) return 'none';
  if (facts.lastEngagedAt && facts.lastEngagedAt.getTime() > cutoff) return 'none';
  return 'notice';
}

/** One newsletter draft per shop-local month. */
export function newsletterKey(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', timeZone }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const month = parts.find((p) => p.type === 'month')?.value ?? '00';
  return `newsletter-${year}-${month}`;
}
