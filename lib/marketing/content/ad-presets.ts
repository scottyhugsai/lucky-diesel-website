/**
 * App-side ad settings the adapters read: campaign templates, local geo
 * presets, negative keywords, call-hour dayparting, special ad category and
 * the platform AI-rewrite toggle. Stored per campaign in `ad_campaigns.audience`
 * (so they are part of what the owner approves). Pure.
 */

export type CampaignObjective = 'leads' | 'traffic' | 'calls' | 'awareness' | 'sales';

export interface Town {
  key: string;
  name: string;
  latitude: number;
  longitude: number;
}

/** Towns around the shop. Each adds a 10-mile circle (or excludes one). */
export const TOWNS: readonly Town[] = [
  { key: 'north_charleston', name: 'North Charleston', latitude: 32.8546, longitude: -79.9748 },
  { key: 'mount_pleasant', name: 'Mount Pleasant', latitude: 32.8323, longitude: -79.8284 },
  { key: 'summerville', name: 'Summerville', latitude: 33.0185, longitude: -80.1756 },
  { key: 'goose_creek', name: 'Goose Creek', latitude: 32.981, longitude: -80.0326 },
  { key: 'hanahan', name: 'Hanahan', latitude: 32.9185, longitude: -80.022 },
  { key: 'moncks_corner', name: 'Moncks Corner', latitude: 33.196, longitude: -80.0131 },
  { key: 'james_island', name: 'James Island', latitude: 32.7379, longitude: -79.9428 },
  { key: 'johns_island', name: 'Johns Island', latitude: 32.6916, longitude: -80.0806 },
  { key: 'west_ashley', name: 'West Ashley', latitude: 32.7846, longitude: -80.0303 },
  { key: 'ladson', name: 'Ladson', latitude: 33.0118, longitude: -80.111 },
  { key: 'awendaw', name: 'Awendaw', latitude: 33.0371, longitude: -79.6131 },
  { key: 'ravenel', name: 'Ravenel', latitude: 32.7632, longitude: -80.2509 },
];
export const TOWN_RADIUS_MILES = 10;

/** Charleston city centre until the owner sets the street address. */
export const SHOP_LOCATION = { latitude: 32.7765, longitude: -79.9311 };

/** Searches that waste money or invite illegal work. Applied to Google campaigns. */
export const NEGATIVE_KEYWORDS: readonly string[] = [
  'free', 'diy', 'how to', 'youtube', 'manual pdf', 'jobs', 'hiring', 'salary', 'school', 'training', 'cdl',
  'junkyard', 'salvage', 'used truck for sale', 'for sale', 'cheap', 'rental', 'delete', 'deleted', 'tuner download',
];

export interface CallHours {
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  startHour: number;
  endHour: number;
}

export const DEFAULT_CALL_HOURS: CallHours = { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 17 };

export type SpecialCategory = 'none' | 'financial';

export interface Targeting {
  template: string | null;
  radiusMiles: number;
  towns: string[];
  excludeTowns: string[];
  negativeKeywords: boolean;
  /** null = run all day. */
  callHours: CallHours | null;
  specialCategory: SpecialCategory;
  /** Let Meta/Google rewrite or crop approved creative. Off by default. */
  aiEnhancements: boolean;
  note: string | null;
}

export interface CampaignTemplate {
  key: string;
  label: string;
  hint: string;
  objective: CampaignObjective;
  dailyDollars: number;
  days: number;
  targeting: Omit<Targeting, 'template' | 'note'>;
}

const BASE: Omit<Targeting, 'template' | 'note'> = { radiusMiles: 30, towns: [], excludeTowns: [], negativeKeywords: true, callHours: null, specialCategory: 'none', aiEnhancements: false };

export const CAMPAIGN_TEMPLATES: readonly CampaignTemplate[] = [
  { key: 'calls', label: 'Call ads', hint: 'Phone calls in shop hours.', objective: 'calls', dailyDollars: 20, days: 14, targeting: { ...BASE, radiusMiles: 25, callHours: DEFAULT_CALL_HOURS } },
  { key: 'tow_season', label: 'Tow season', hint: 'Tow-ready checks, wider area.', objective: 'leads', dailyDollars: 25, days: 30, targeting: { ...BASE, radiusMiles: 35, towns: ['summerville', 'goose_creek', 'moncks_corner'] } },
  { key: 'dyno_day', label: 'Dyno day', hint: 'Short push before an event.', objective: 'awareness', dailyDollars: 15, days: 10, targeting: { ...BASE, radiusMiles: 50 } },
  { key: 'parts', label: 'Parts sales', hint: 'Store traffic, wide radius.', objective: 'sales', dailyDollars: 20, days: 30, targeting: { ...BASE, radiusMiles: 60 } },
  { key: 'financing', label: 'Financing offer', hint: 'Runs as a financial ad.', objective: 'leads', dailyDollars: 20, days: 21, targeting: { ...BASE, radiusMiles: 30, specialCategory: 'financial' } },
];

/** Meta requires ≥15-mile radius and no age targeting for special ad categories. */
export const SPECIAL_CATEGORY_MIN_RADIUS = 15;

const FINANCING = /\b(financ(e|ed|ing)|apr|credit (approval|check)|no credit|monthly payments?|pay over time|payment plans?|0% interest|interest[- ]free|buy now,? pay later|affirm|klarna)\b/i;

/** Financing or credit wording → must run under Meta's financial products category. */
export function detectSpecialCategory(texts: readonly (string | null | undefined)[]): SpecialCategory {
  return texts.some((t) => t && FINANCING.test(t)) ? 'financial' : 'none';
}

const clampInt = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : fallback;

function townKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((k): k is string => typeof k === 'string' && TOWNS.some((t) => t.key === k)))];
}

function callHours(value: unknown): CallHours | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const days = Array.isArray(v.days) ? [...new Set(v.days.filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort() : [];
  const startHour = clampInt(v.startHour, 0, 23, -1);
  const endHour = clampInt(v.endHour, 1, 24, -1);
  if (!days.length || startHour < 0 || endHour <= startHour) return null;
  return { days, startHour, endHour };
}

/** Normalises a stored `audience` object. Unknown or bad values fall back to safe defaults. */
export function parseTargeting(raw: unknown): Targeting {
  const v = (typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const specialCategory: SpecialCategory = v.specialCategory === 'financial' ? 'financial' : 'none';
  const radius = clampInt(v.radiusMiles, 1, 100, 30);
  const towns = townKeys(v.towns);
  return {
    template: typeof v.template === 'string' && CAMPAIGN_TEMPLATES.some((t) => t.key === v.template) ? v.template : null,
    radiusMiles: specialCategory === 'financial' ? Math.max(radius, SPECIAL_CATEGORY_MIN_RADIUS) : radius,
    towns,
    excludeTowns: townKeys(v.excludeTowns).filter((k) => !towns.includes(k)),
    negativeKeywords: v.negativeKeywords !== false,
    callHours: callHours(v.callHours),
    specialCategory,
    aiEnhancements: v.aiEnhancements === true,
    note: typeof v.note === 'string' ? v.note.slice(0, 200) : null,
  };
}

export interface GeoCircle {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  name: string;
}

/** Include and exclude circles: the shop radius plus any chosen towns. */
export function geoCircles(t: Targeting): { include: GeoCircle[]; exclude: GeoCircle[] } {
  const circle = (town: Town, radiusMiles = TOWN_RADIUS_MILES): GeoCircle => ({ latitude: town.latitude, longitude: town.longitude, radiusMiles, name: town.name });
  const minRadius = t.specialCategory === 'financial' ? SPECIAL_CATEGORY_MIN_RADIUS : 1;
  return {
    include: [
      { ...SHOP_LOCATION, radiusMiles: t.radiusMiles, name: 'Shop' },
      ...t.towns.map((k) => circle(TOWNS.find((town) => town.key === k)!, Math.max(TOWN_RADIUS_MILES, minRadius))),
    ],
    exclude: t.excludeTowns.map((k) => circle(TOWNS.find((town) => town.key === k)!, 3)),
  };
}

const WEEKDAY = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

/** Google Ads AdScheduleInfo criteria for call hours (account time zone). */
export function googleAdSchedule(hours: CallHours | null): { dayOfWeek: string; startHour: number; startMinute: 'ZERO'; endHour: number; endMinute: 'ZERO' }[] {
  if (!hours) return [];
  return hours.days.map((d) => ({ dayOfWeek: WEEKDAY[d]!, startHour: hours.startHour, startMinute: 'ZERO', endHour: hours.endHour, endMinute: 'ZERO' }));
}

/** TikTok `dayparting`: 336 chars, Monday first, one per half hour. Empty string = all day. */
export function tiktokDayparting(hours: CallHours | null): string {
  if (!hours) return '';
  const mondayFirst = [1, 2, 3, 4, 5, 6, 0];
  return mondayFirst.map((day) => Array.from({ length: 48 }, (_, slot) => (hours.days.includes(day) && slot >= hours.startHour * 2 && slot < hours.endHour * 2 ? '1' : '0')).join('')).join('');
}

/** One-line summary for cards. */
export function describeTargeting(t: Targeting): string {
  const parts = [`${t.radiusMiles} mi`];
  if (t.towns.length) parts.push(`+${t.towns.length} towns`);
  if (t.excludeTowns.length) parts.push(`−${t.excludeTowns.length} towns`);
  if (t.callHours) parts.push(`${t.callHours.startHour}–${t.callHours.endHour}h`);
  if (t.specialCategory === 'financial') parts.push('financial ad');
  if (t.aiEnhancements) parts.push('AI edits on');
  return parts.join(' · ');
}
