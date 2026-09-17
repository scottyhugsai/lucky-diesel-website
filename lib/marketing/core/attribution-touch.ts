/**
 * Pure first-party attribution: parse UTM / click ids from a landing URL,
 * normalise the source and (de)serialise the `ld_attr` cookie. Runtime-neutral
 * (no Node APIs) so the proxy can use it.
 */

export const ATTRIBUTION_COOKIE = 'ld_attr';
export const REFERRAL_COOKIE = 'ld_ref';
export const ATTRIBUTION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export type TouchSource =
  | 'google' | 'facebook' | 'instagram' | 'tiktok' | 'bing' | 'youtube'
  | 'referral' | 'email' | 'sms' | 'direct' | 'other';

export const TOUCH_SOURCES: readonly TouchSource[] = ['google', 'facebook', 'instagram', 'tiktok', 'bing', 'youtube', 'referral', 'email', 'sms', 'direct', 'other'];

export interface TouchData {
  source: TouchSource;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  fbclid: string | null;
  ttclid: string | null;
  msclkid: string | null;
  /** Referral program code from `?ref=`. */
  ref: string | null;
  /** Our campaign id from `?ld_cid=` (campaign links). */
  campaignId: string | null;
  referrer: string | null;
  landingPath: string;
  at: string;
}

export interface AttributionCookie {
  aid: string;
  ft: TouchData | null;
  lt: TouchData | null;
}

const MAX_VALUE = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ANON_ID = /^[A-Za-z0-9_-]{8,64}$/;
const REF_CODE = /^[A-Z0-9-]{4,32}$/;

export const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid', 'ref', 'ld_cid',
] as const;

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/[\u0000-\u001f]/g, '').slice(0, MAX_VALUE);
  return trimmed || null;
}

const SOURCE_ALIASES: [RegExp, TouchSource][] = [
  [/^(?:ig|insta|instagram)/, 'instagram'],
  [/^(?:fb|facebook|meta)/, 'facebook'],
  [/^(?:google|gads|adwords|gbp|gmb|lsa)/, 'google'],
  [/^(?:tiktok|tt)$/, 'tiktok'],
  [/^(?:bing|microsoft|msads)/, 'bing'],
  [/^(?:youtube|yt)$/, 'youtube'],
  [/^(?:email|newsletter|resend|mail)/, 'email'],
  [/^(?:sms|text|twilio)/, 'sms'],
  [/^(?:referral|friend|refer)/, 'referral'],
  [/^direct$/, 'direct'],
];

const REFERRER_HOSTS: [RegExp, TouchSource][] = [
  [/(^|\.)google\./, 'google'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|messenger\.com)$/, 'facebook'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
];

/** Maps raw utm_source / legacy `customers.source` strings onto a known channel. */
export function normalizeSourceName(raw: string | null | undefined): TouchSource {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value || ['website', 'online booking', 'walk-in', 'walk in', 'phone', 'none', '(direct)'].includes(value)) return 'direct';
  for (const [pattern, source] of SOURCE_ALIASES) if (pattern.test(value)) return source;
  return 'other';
}

function hostOf(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Parses a landing URL. Returns null for internal navigation and plain direct
 * visits, so the stored last touch isn't overwritten by clicking around the site.
 */
export function parseTouch(url: URL, referrer: string | null, now: Date, ownHost = url.hostname): TouchData | null {
  const q = (key: string) => clean(url.searchParams.get(key));
  const referrerHost = hostOf(referrer);
  const external = referrerHost && referrerHost !== ownHost.toLowerCase() ? referrerHost : null;
  const hasParams = TRACKING_PARAMS.some((key) => url.searchParams.has(key));
  if (!hasParams && !external) return null;

  const ref = q('ref')?.toUpperCase() ?? null;
  const campaignId = q('ld_cid');
  const touch: TouchData = {
    source: 'direct',
    medium: q('utm_medium'),
    campaign: q('utm_campaign'),
    term: q('utm_term'),
    content: q('utm_content'),
    gclid: q('gclid'), gbraid: q('gbraid'), wbraid: q('wbraid'),
    fbclid: q('fbclid'), ttclid: q('ttclid'), msclkid: q('msclkid'),
    ref: ref && REF_CODE.test(ref) ? ref : null,
    campaignId: campaignId && UUID.test(campaignId) ? campaignId : null,
    referrer: external ? clean(referrer) : null,
    landingPath: url.pathname.slice(0, MAX_VALUE),
    at: now.toISOString(),
  };
  touch.source = sourceFor({ ...touch, utmSource: q('utm_source'), referrerHost: external });
  if (!touch.medium && (touch.gclid || touch.gbraid || touch.wbraid || touch.fbclid || touch.ttclid || touch.msclkid)) touch.medium = 'paid';
  if (!touch.medium && external && touch.source !== 'other') touch.medium = 'organic';
  if (!touch.medium && external) touch.medium = 'referral';
  return touch;
}

/** Source precedence: utm_source → click ids → referral code → referrer host. */
export function sourceFor(input: { utmSource: string | null; gclid?: string | null; gbraid?: string | null; wbraid?: string | null; fbclid?: string | null; ttclid?: string | null; msclkid?: string | null; ref?: string | null; referrerHost?: string | null }): TouchSource {
  if (input.utmSource) {
    const named = normalizeSourceName(input.utmSource);
    if (named !== 'direct') return named;
  }
  if (input.gclid || input.gbraid || input.wbraid) return 'google';
  if (input.fbclid) return 'facebook';
  if (input.ttclid) return 'tiktok';
  if (input.msclkid) return 'bing';
  if (input.ref) return 'referral';
  if (input.referrerHost) {
    for (const [pattern, source] of REFERRER_HOSTS) if (pattern.test(input.referrerHost)) return source;
    return 'other';
  }
  return 'direct';
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** Null fields are dropped to keep the cookie small; the decoder restores them. */
export function encodeAttributionCookie(value: AttributionCookie): string {
  return toBase64Url(JSON.stringify(value, (_key, field: unknown) => (field === null ? undefined : field)));
}

function isTouch(value: unknown): value is TouchData {
  if (!value || typeof value !== 'object') return false;
  const touch = value as Record<string, unknown>;
  return typeof touch.source === 'string' && (TOUCH_SOURCES as readonly string[]).includes(touch.source)
    && typeof touch.at === 'string' && !Number.isNaN(Date.parse(touch.at)) && typeof touch.landingPath === 'string';
}

/** Never trusts the cookie: shape-checks and re-cleans every field. */
export function decodeAttributionCookie(raw: string | null | undefined): AttributionCookie | null {
  if (!raw || raw.length > 4096) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(raw));
    if (!parsed || typeof parsed !== 'object') return null;
    const { aid, ft, lt } = parsed as Record<string, unknown>;
    if (typeof aid !== 'string' || !ANON_ID.test(aid)) return null;
    return { aid, ft: isTouch(ft) ? sanitizeTouch(ft) : null, lt: isTouch(lt) ? sanitizeTouch(lt) : null };
  } catch {
    return null;
  }
}

function sanitizeTouch(touch: TouchData): TouchData {
  const ref = clean(touch.ref)?.toUpperCase() ?? null;
  const campaignId = clean(touch.campaignId);
  return {
    source: touch.source,
    medium: clean(touch.medium), campaign: clean(touch.campaign), term: clean(touch.term), content: clean(touch.content),
    gclid: clean(touch.gclid), gbraid: clean(touch.gbraid), wbraid: clean(touch.wbraid),
    fbclid: clean(touch.fbclid), ttclid: clean(touch.ttclid), msclkid: clean(touch.msclkid),
    ref: ref && REF_CODE.test(ref) ? ref : null,
    campaignId: campaignId && UUID.test(campaignId) ? campaignId : null,
    referrer: clean(touch.referrer),
    landingPath: touch.landingPath.slice(0, MAX_VALUE),
    at: new Date(touch.at).toISOString(),
  };
}

/** Next cookie value after a page view: first touch is kept, last touch replaced. */
export function nextAttribution(existing: AttributionCookie | null, touch: TouchData | null, newId: () => string): AttributionCookie {
  const base = existing ?? { aid: newId(), ft: null, lt: null };
  if (!touch) return base;
  return { aid: base.aid, ft: base.ft ?? touch, lt: touch };
}
