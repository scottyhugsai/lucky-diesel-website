/**
 * Pure rules for outside triggers: NHTSA recalls, NWS weather alerts, open-bay
 * fill, tune revisions, local event drafts, review themes and review reply
 * auto-posting. No I/O; the services in local-triggers.ts / recalls.ts call these.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

// ─── Recalls ────────────────────────────────────────────────────────────────
export interface RecallMatch {
  campaignNumber: string;
  component: string | null;
  summary: string | null;
  remedy: string | null;
  reportDate: string | null;
}

const clip = (value: unknown, max: number): string | null => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);

/** NHTSA `recallsByVehicle` JSON → clean rows. Bad shapes return []. */
export function parseNhtsaRecalls(json: unknown): RecallMatch[] {
  const results = (json as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];
  const seen = new Set<string>();
  return results.flatMap((r: Record<string, unknown>) => {
    const campaignNumber = clip(r?.NHTSACampaignNumber, 40);
    if (!campaignNumber || !/^[A-Z0-9-]{3,40}$/i.test(campaignNumber) || seen.has(campaignNumber)) return [];
    seen.add(campaignNumber);
    const [d, m, y] = String(r.ReportReceivedDate ?? '').split('/');
    const reportDate = y && /^\d{4}$/.test(y) && /^\d{2}$/.test(m ?? '') && /^\d{2}$/.test(d ?? '') ? `${y}-${m}-${d}` : null;
    return [{ campaignNumber, component: clip(r.Component, 200), summary: clip(r.Summary, 1000), remedy: clip(r.Remedy, 1000), reportDate }];
  });
}

/** NHTSA wants the plain model (e.g. "F-250 Super Duty" → "F-250"). Returns candidates to try in order. */
export function recallModelCandidates(model: string | null): string[] {
  const clean = (model ?? '').trim();
  if (!clean) return [];
  const first = clean.split(/\s+/)[0]!;
  return [...new Set([clean, first])].filter((m) => /^[\w .-]{1,40}$/.test(m));
}

/** Short text for the email: "TIRES:TREAD/BELT (11T002000)". */
export function recallLabel(recall: Pick<RecallMatch, 'campaignNumber' | 'component'>): string {
  const component = (recall.component ?? 'safety recall').toLowerCase().replace(/:/g, ' / ');
  return `${component} (NHTSA ${recall.campaignNumber})`;
}

// ─── Weather ────────────────────────────────────────────────────────────────
export type WeatherKind = 'freeze' | 'storm';
export interface WeatherAlert { id: string; kind: WeatherKind; event: string; headline: string }

const FREEZE = /^(hard )?freeze (warning|watch)$|^wind chill (warning|advisory)$/i;
const STORM = /^(hurricane|tropical storm) (watch|warning)$/i;

/** NWS `alerts/active` GeoJSON → alerts we act on. */
export function classifyNwsAlerts(json: unknown): WeatherAlert[] {
  const features = (json as { features?: unknown })?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((f: { properties?: Record<string, unknown> }) => {
    const p = f?.properties ?? {};
    const id = clip(p.id, 200);
    const event = clip(p.event, 80);
    if (!id || !event) return [];
    const kind: WeatherKind | null = FREEZE.test(event) ? 'freeze' : STORM.test(event) ? 'storm' : null;
    return kind ? [{ id, kind, event, headline: clip(p.headline, 200) ?? event }] : [];
  });
}

// ─── Open bay fill ──────────────────────────────────────────────────────────
export const OPEN_BAY_MIN_FREE_SHARE = 0.6;
export const OPEN_BAY_MAX_RECIPIENTS = 40;

/** Fire when at least 60% of the next-2-day capacity is open. */
export function shouldFillBays(openSlots: number, totalSlots: number, minShare = OPEN_BAY_MIN_FREE_SHARE): boolean {
  return totalSlots > 0 && openSlots / totalSlots >= minShare;
}

/** Recent paying customers (≤ 12 months), no upcoming booking, newest first, capped. */
export function openBayRecipients(
  lastPaid: ReadonlyMap<string, string>,
  booked: ReadonlySet<string>,
  now: Date,
  max = OPEN_BAY_MAX_RECIPIENTS,
): string[] {
  return [...lastPaid]
    .filter(([id, paidAt]) => !booked.has(id) && now.getTime() - Date.parse(paidAt) <= 365 * DAY_MS)
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, max)
    .map(([id]) => id);
}

// ─── Tune revisions ─────────────────────────────────────────────────────────
/** Natural compare of revision strings: "v2.10" > "v2.9". */
export function compareRevisions(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

/** Latest tune per vehicle from this calibrator, compliant, on an older revision. */
export function vehiclesOnOlderRevision(
  tunes: readonly { vehicleId: string; customerId: string; calibrator: string | null; revision: string | null; emissionsCompliant: boolean | null; flashedAt: string }[],
  calibrator: string,
  revision: string,
): { vehicleId: string; customerId: string; revision: string }[] {
  const latest = new Map<string, (typeof tunes)[number]>();
  for (const tune of tunes) {
    if ((tune.calibrator ?? '').trim().toLowerCase() !== calibrator.trim().toLowerCase()) continue;
    const current = latest.get(tune.vehicleId);
    if (!current || tune.flashedAt > current.flashedAt) latest.set(tune.vehicleId, tune);
  }
  return [...latest.values()]
    .filter((t) => t.emissionsCompliant === true && t.revision && compareRevisions(t.revision, revision) < 0)
    .map((t) => ({ vehicleId: t.vehicleId, customerId: t.customerId, revision: t.revision! }));
}

// ─── Local events ───────────────────────────────────────────────────────────
export const LOCAL_EVENT_LEAD_DAYS = 14;

/** Events 0–14 days out that don't have a draft yet. `today` is a shop-local YYYY-MM-DD. */
export function localEventsNeedingDraft<T extends { startsOn: string; draftCampaignId: string | null }>(events: readonly T[], today: string): T[] {
  const base = Date.parse(`${today}T12:00:00Z`);
  return events.filter((e) => {
    const days = (Date.parse(`${e.startsOn}T12:00:00Z`) - base) / DAY_MS;
    return !e.draftCampaignId && days >= 0 && days <= LOCAL_EVENT_LEAD_DAYS;
  });
}

// ─── Reviews ────────────────────────────────────────────────────────────────
export const REVIEW_THEMES = ['price', 'communication', 'turnaround', 'quality', 'honesty', 'staff'] as const;
export type ReviewTheme = (typeof REVIEW_THEMES)[number];

const THEME_PATTERNS: Record<ReviewTheme, RegExp> = {
  price: /\b(price[sd]?|pricing|cost|expensive|cheap|fair(ly)? priced|overcharg\w*|quote[sd]?|bill|invoice|money|afford\w*)\b/i,
  communication: /\b(communicat\w*|call(ed)? me|kept me (updated|informed|posted)|update[sd]?|text(ed|s)?|respon\w*|explain\w*|photos?|never heard|no one called)\b/i,
  turnaround: /\b(fast|quick(ly)?|same day|on time|turnaround|took (forever|weeks|days)|wait(ed|ing)?|delay\w*|slow|promised|days? late)\b/i,
  quality: /\b(runs? (great|perfect|better|strong)|quality|fixed|diagnos\w*|knowledge\w*|expert\w*|workmanship|still (broken|leaking)|came back|didn'?t fix|professional)\b/i,
  honesty: /\b(honest\w*|trust\w*|upsell\w*|straight (up|shooter)|transparent|scam|rip(ped)? off|integrity)\b/i,
  staff: /\b(staff|team|owner|tech(nician)?s?|friendly|rude|guys|crew|customer service)\b/i,
};

/** Keyword tagger for reviews and survey comments. */
export function tagThemes(text: string | null | undefined): ReviewTheme[] {
  if (!text) return [];
  return REVIEW_THEMES.filter((theme) => THEME_PATTERNS[theme].test(text));
}

export const REPLY_SLA_HOURS = { low: 24, high: 72 } as const;

/** Unreplied public review older than 24h (≤3★) or 72h (≥4★). */
export function replyOverdue(review: { rating: number; reviewedAt: string; replied: boolean; source: string }, now: Date): { overdue: boolean; hours: number; limit: number } {
  const limit = review.rating <= 3 ? REPLY_SLA_HOURS.low : REPLY_SLA_HOURS.high;
  const hours = Math.max(0, Math.floor((now.getTime() - Date.parse(review.reviewedAt)) / HOUR_MS));
  return { overdue: !review.replied && review.source !== 'internal' && review.source !== 'sample' && hours > limit, hours, limit };
}

export const AUTO_POST_AFTER_HOURS = 2;

/** 5-star, compliance-clean, owner hasn't edited, waiting at least 2 hours. */
export function canAutoPostReply(reply: { rating: number; status: string; compliance: string; edited: boolean; createdAt: string }, now: Date): boolean {
  return reply.rating === 5
    && reply.status === 'pending_approval'
    && reply.compliance === 'pass'
    && !reply.edited
    && now.getTime() - Date.parse(reply.createdAt) >= AUTO_POST_AFTER_HOURS * HOUR_MS;
}

export interface VelocityMonth { label: string; reviews: number; average: number | null }

/** Last `months` calendar months of public reviews (oldest first). */
export function reviewVelocity(reviews: readonly { rating: number; reviewedAt: string; source: string }[], now: Date, months = 6, timeZone = 'America/New_York'): VelocityMonth[] {
  const key = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).format(d);
  const label = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone, month: 'short' }).format(d);
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getTime());
    d.setUTCDate(15);
    d.setUTCMonth(d.getUTCMonth() - (months - 1 - i));
    return { key: key(d), label: label(d), ratings: [] as number[] };
  });
  for (const r of reviews) {
    if (r.source === 'internal' || r.source === 'sample') continue;
    buckets.find((b) => b.key === key(new Date(r.reviewedAt)))?.ratings.push(r.rating);
  }
  return buckets.map((b) => ({ label: b.label, reviews: b.ratings.length, average: b.ratings.length ? Math.round((b.ratings.reduce((t, n) => t + n, 0) / b.ratings.length) * 10) / 10 : null }));
}
