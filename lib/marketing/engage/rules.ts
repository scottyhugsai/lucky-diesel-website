/**
 * Pure rules for on-site engagement: announcement bar, page popups, price ranges,
 * A/B buckets, cookie consent, call tracking numbers, social proof, chat hours.
 * Shared by server loaders, public components and admin actions.
 */

const DAY_MS = 86_400_000;

// ─── "How did you hear about us?" ────────────────────────────────────────────
export const HEARD_ABOUT_OPTIONS = [
  { id: 'google', label: 'Google search' },
  { id: 'maps', label: 'Google Maps' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'friend', label: 'Friend or family' },
  { id: 'truck', label: 'Saw a truck we did' },
  { id: 'event', label: 'Event or dyno day' },
  { id: 'returning', label: 'Been here before' },
  { id: 'other', label: 'Other' },
] as const;

export function parseHeardAbout(value: unknown): string | null {
  return typeof value === 'string' && HEARD_ABOUT_OPTIONS.some((o) => o.id === value) ? value : null;
}

export function heardAboutLabel(id: string | null): string | null {
  return HEARD_ABOUT_OPTIONS.find((o) => o.id === id)?.label ?? null;
}

// ─── VIN ─────────────────────────────────────────────────────────────────────
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export function cleanVin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.toUpperCase().replace(/[\s-]/g, '');
  return VIN_PATTERN.test(clean) ? clean : null;
}

// ─── Announcement bar ────────────────────────────────────────────────────────
export interface Announcement {
  text: string;
  href: string | null;
  linkLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  countdown: boolean;
}

const SITE_PATH = /^\/(?!\/)[A-Za-z0-9/_\-?=&#.%]*$/;

export function isSitePath(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 200 && SITE_PATH.test(value);
}

function isoOrNull(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
}

export function parseAnnouncement(raw: unknown): Announcement | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.text !== 'string' || !v.text.trim() || v.text.length > 120) return null;
  return {
    text: v.text.trim(),
    href: isSitePath(v.href) ? v.href : null,
    linkLabel: typeof v.linkLabel === 'string' && v.linkLabel.trim() ? v.linkLabel.trim().slice(0, 30) : null,
    startsAt: isoOrNull(v.startsAt),
    endsAt: isoOrNull(v.endsAt),
    countdown: v.countdown === true,
  };
}

export function isLive(window: { startsAt: string | null; endsAt: string | null }, now: Date): boolean {
  if (window.startsAt && Date.parse(window.startsAt) > now.getTime()) return false;
  if (window.endsAt && Date.parse(window.endsAt) <= now.getTime()) return false;
  return true;
}

/** "3 days left" / "5 hours left" / "Ends soon"; null when no end date or already over. */
export function countdownLabel(endsAt: string | null, now: Date): string | null {
  if (!endsAt) return null;
  const ms = Date.parse(endsAt) - now.getTime();
  if (!(ms > 0)) return null;
  if (ms >= 2 * DAY_MS) return `${Math.floor(ms / DAY_MS)} days left`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 2) return `${hours} hours left`;
  return 'Ends soon';
}

/** Stable id so a dismissal only hides this announcement, not the next one. */
export function announcementId(a: Announcement): string {
  let hash = 0;
  for (const ch of `${a.text}|${a.href ?? ''}|${a.endsAt ?? ''}`) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) | 0;
  return (hash >>> 0).toString(36);
}

// ─── Page popups ─────────────────────────────────────────────────────────────
export interface PopupRule {
  id: string;
  pathPrefix: string;
  trigger: 'time' | 'scroll';
  triggerValue: number;
  headline: string;
  body: string | null;
  ctaLabel: string;
  ctaHref: string;
  startsAt: string | null;
  endsAt: string | null;
}

/** Most specific live popup for a path (longest matching prefix wins). */
export function pickPopup<T extends PopupRule>(popups: readonly T[], pathname: string, now: Date): T | null {
  const matches = popups.filter((p) => {
    if (!isLive(p, now)) return false;
    if (p.pathPrefix === '/') return true;
    return pathname === p.pathPrefix || pathname.startsWith(p.pathPrefix.endsWith('/') ? p.pathPrefix : `${p.pathPrefix}/`);
  });
  return matches.sort((a, b) => b.pathPrefix.length - a.pathPrefix.length)[0] ?? null;
}

// ─── Price ranges ────────────────────────────────────────────────────────────
export interface PriceRange {
  service: string;
  /** Platform id, or "any". */
  platform: string;
  lowCents: number;
  highCents: number;
}

const MAX_RANGE_CENTS = 10_000_000;

export function parsePriceRanges(raw: unknown): PriceRange[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const v = item as Record<string, unknown>;
    const low = Number(v.lowCents);
    const high = Number(v.highCents);
    if (typeof v.service !== 'string' || typeof v.platform !== 'string') return [];
    if (!Number.isInteger(low) || !Number.isInteger(high) || low < 0 || high < low || high > MAX_RANGE_CENTS) return [];
    return [{ service: v.service, platform: v.platform, lowCents: low, highCents: high }];
  });
}

/** Platform-specific range first, then the service's "any" range. */
export function priceRangeFor(ranges: readonly PriceRange[], service: string, platform: string): PriceRange | null {
  return ranges.find((r) => r.service === service && r.platform === platform)
    ?? ranges.find((r) => r.service === service && r.platform === 'any')
    ?? null;
}

const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;

export function formatRange(range: Pick<PriceRange, 'lowCents' | 'highCents'>): string {
  return range.lowCents === range.highCents ? dollars(range.lowCents) : `${dollars(range.lowCents)}–${dollars(range.highCents)}`;
}

/** Adds or replaces the range for one service × platform. */
export function upsertRange(ranges: readonly PriceRange[], next: PriceRange): PriceRange[] {
  return [...ranges.filter((r) => !(r.service === next.service && r.platform === next.platform)), next];
}

// ─── A/B tests ───────────────────────────────────────────────────────────────
export interface AbVariant { key: string; text: string }

export function parseVariants(raw: unknown): AbVariant[] {
  if (!Array.isArray(raw)) return [];
  const variants = raw.flatMap((v) => (v && typeof v === 'object' && typeof (v as AbVariant).key === 'string' && /^[a-z]$/.test((v as AbVariant).key)
    && typeof (v as AbVariant).text === 'string' && (v as AbVariant).text.trim() ? [{ key: (v as AbVariant).key, text: (v as AbVariant).text.trim().slice(0, 80) }] : []));
  return variants.length >= 2 ? variants.slice(0, 4) : [];
}

/** Deterministic bucket: the same visitor always sees the same variant of a test (FNV-1a). */
export function abBucket(visitorId: string, testId: string, count: number): number {
  let hash = 0x811c9dc5;
  for (const ch of `${testId}:${visitorId}`) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % Math.max(1, count);
}

export interface AbVariantStats { key: string; exposures: number; conversions: number; rate: number }

export function abStats(variants: readonly AbVariant[], events: readonly { variant: string; kind: string }[]): AbVariantStats[] {
  return variants.map((v) => {
    const exposures = events.filter((e) => e.variant === v.key && e.kind === 'exposure').length;
    const conversions = events.filter((e) => e.variant === v.key && e.kind === 'conversion').length;
    return { key: v.key, exposures, conversions, rate: exposures ? conversions / exposures : 0 };
  });
}

export const AB_SLOTS = [
  { id: 'quote_cta', label: 'Quote form button', fallback: 'Send service request' },
  { id: 'quote_heading', label: 'Quote form first step', fallback: 'Where do we reach you?' },
] as const;

export const VISITOR_ID = /^[A-Za-z0-9_-]{8,64}$/;

// ─── Cookie consent ──────────────────────────────────────────────────────────
export const CONSENT_COOKIE = 'ld_consent';
export const CONSENT_MAX_AGE_SECONDS = 180 * 86_400;

export interface ConsentChoice { analytics: boolean; ads: boolean; version: string }

export function encodeConsent(choice: ConsentChoice): string {
  return `v=${choice.version}&a=${choice.analytics ? 1 : 0}&m=${choice.ads ? 1 : 0}`;
}

export function parseConsent(raw: string | null | undefined): ConsentChoice | null {
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const version = params.get('v');
  if (!version || !/^[A-Za-z0-9._-]{1,40}$/.test(version)) return null;
  return { version, analytics: params.get('a') === '1', ads: params.get('m') === '1' };
}

/** A choice made under an older policy version must be asked again. */
export function needsConsentPrompt(choice: ConsentChoice | null, currentVersion: string): boolean {
  return !choice || choice.version !== currentVersion;
}

// ─── Call tracking / dynamic number insertion ────────────────────────────────
export function toE164Us(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return national.length === 10 ? `+1${national}` : null;
}

export function displayPhone(e164: string): string {
  const d = e164.replace(/\D/g, '').slice(-10);
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Tracking number for a visitor's last-touch source (exact match), else null (keep the main number). */
export function numberForSource<T extends { source: string }>(numbers: readonly T[], source: string | null): T | null {
  if (!source) return null;
  const s = source.toLowerCase();
  return numbers.find((n) => n.source === s) ?? null;
}

// ─── Social proof ────────────────────────────────────────────────────────────
export const SOCIAL_PROOF_MIN = 3;

/** Real counts only. Below the minimum, say nothing rather than a weak or padded number. */
export function socialProofMessage(counts: { finishedJobs: number; dynoRuns: number }): string | null {
  if (counts.dynoRuns >= SOCIAL_PROOF_MIN) return `${counts.dynoRuns} trucks on our dyno this week`;
  if (counts.finishedJobs >= SOCIAL_PROOF_MIN) return `${counts.finishedJobs} trucks finished in our shop this week`;
  return null;
}

// ─── Chat ────────────────────────────────────────────────────────────────────
export const CHAT_MAX_BODY = 1000;

export function cleanChatBody(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Strip control characters except newlines/tabs.
  const body = value.replace(/[ --]/g, '').trim();
  return body && body.length <= CHAT_MAX_BODY ? body : null;
}

/** Shop hours in local time: weekdays open–close (24h), closed weekends unless set. */
export function isShopOpen(now: Date, timeZone: string, hours: { open: number; close: number; days: readonly number[] }): boolean {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((p) => p.type === 'weekday')?.value ?? '');
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return hours.days.includes(weekday) && hour >= hours.open && hour < hours.close;
}

/** Assumed until the owner confirms hours (lib/site.ts has none yet). */
export const CHAT_HOURS = { open: 8, close: 18, days: [1, 2, 3, 4, 5] } as const;

/** Scripted after-hours qualifier: asks for what the shop needs to quote, in order. */
export function afterHoursPrompt(known: { hasTruck: boolean; hasService: boolean }): string {
  if (!known.hasTruck) return 'Thanks! The shop is closed right now. What truck is it (year, make, engine)? A tech will reply first thing.';
  if (!known.hasService) return 'Got it. What do you need done, and is the truck drivable?';
  return 'Thanks, that’s what we need. A tech will reply when the shop opens.';
}

// ─── Waitlists ───────────────────────────────────────────────────────────────
export const WAITLIST_TOPIC = /^[a-z0-9:_-]{2,120}$/;

export function waitlistTopic(kind: 'product' | 'tune' | 'event', key: string): string | null {
  const clean = key.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
  const topic = `${kind}:${clean}`;
  return clean && WAITLIST_TOPIC.test(topic) ? topic : null;
}

// ─── Partial forms ───────────────────────────────────────────────────────────

/** Shared by the browser that mints the key and the route that validates it, so the two cannot drift. */
export const PARTIAL_SESSION_KEY = /^[A-Za-z0-9_-]{16,64}$/;
export const PARTIAL_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const REMIND_CONSENT_VERSION = '2026-09-17-quote-reminder';
export const REMIND_CONSENT_TEXT = 'Email me one reminder if I don’t finish. No other marketing unless I opt in.';

/** A stable id for one browser's unfinished form, so a return visit updates the row instead of adding one. */
export function newPartialSessionKey(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, '');
}

/**
 * Whether an unfinished quote form is worth storing at all.
 *
 * `partial_leads` is read by exactly one thing — the reminder the visitor opted
 * into. A row for somebody who did not tick the box would be their name, phone
 * and email kept for a purpose that does not exist, and the privacy policy says
 * nothing about unfinished forms. So the tick is the gate, not just a filter
 * applied later when the reminder is sent.
 */
export function shouldSavePartial(input: { name: string; phone: string; email: string; remind: boolean }): boolean {
  if (!input.remind) return false;
  return input.name.trim().length >= 2 && PARTIAL_EMAIL.test(input.email.trim()) && toE164Us(input.phone) !== null;
}

/**
 * Whether `partial_leads.remind_consent` may be stored true.
 *
 * A tick in a box is an intention; the column is a claim that consent was
 * recorded. Writing the column straight from the tick let the two come apart —
 * when the ledger write failed (an undeliverable domain, say) the row still
 * asserted consent with no evidence behind it, and the reminder could never be
 * sent anyway because no contact had been created. An earlier successful grant
 * still stands: a later save that captures nothing must not revoke it.
 */
export function remindConsentValue(input: { ticked: boolean; capturedNow: boolean; alreadyGranted: boolean }): boolean {
  if (input.alreadyGranted) return true;
  return input.ticked && input.capturedNow;
}

export const PARTIAL_FOLLOW_UP_AFTER_MS = 60 * 60_000;
export const PARTIAL_FOLLOW_UP_MAX_AGE_MS = 3 * DAY_MS;

export interface PartialCandidate { id: string; updatedAt: string; remindConsent: boolean; convertedLeadId: string | null; followedUpAt: string | null; email: string; phone: string }

/**
 * Partial forms due one reminder: opted in, 1h+ idle, under 3 days old, not converted,
 * and no full lead since from the same email or phone.
 */
export function duePartialFollowUps<T extends PartialCandidate>(partials: readonly T[], recentLeads: readonly { email: string; phone: string; createdAt: string }[], now: Date): T[] {
  return partials.filter((p) => {
    if (!p.remindConsent || p.convertedLeadId || p.followedUpAt) return false;
    const age = now.getTime() - Date.parse(p.updatedAt);
    if (age < PARTIAL_FOLLOW_UP_AFTER_MS || age > PARTIAL_FOLLOW_UP_MAX_AGE_MS) return false;
    return !recentLeads.some((l) => (l.email.toLowerCase() === p.email.toLowerCase() || l.phone === p.phone) && Date.parse(l.createdAt) >= Date.parse(p.updatedAt) - PARTIAL_FOLLOW_UP_AFTER_MS);
  });
}

/**
 * Whether the site may publish counts of its own shop activity — the
 * "7 trucks finished in our shop this week" line.
 *
 * Those counts come from `work_orders` and `dyno_runs`, and neither table
 * carries an `is_sample` column, unlike the twelve tables that do. `db:seed`
 * writes work orders completed as recently as two hours ago, so on a seeded
 * database that sentence is a factual claim about the shop's volume assembled
 * entirely from demo rows. It is the same failure as the hero stats that were
 * once averaged over sample builds, which is a mistake worth only making once.
 *
 * A query cannot tell a seeded row from a real one here, so the gate has to be
 * the environment: while the demo is on, the site says nothing about volume.
 */
export function mayPublishShopVolume(demoMode: boolean): boolean {
  return !demoMode;
}
