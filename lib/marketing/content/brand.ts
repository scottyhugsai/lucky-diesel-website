import { BUSINESS } from '@/lib/site';
import type { AdGoal, AdPlatform, PlatformId, SocialPlatform } from './types';

/** Brand tokens shared by image templates and copy. Matches app/globals.css. */
export const BRAND_COLORS = {
  carbon: '#0a0c0b',
  carbon2: '#121614',
  gunmetal: '#1c2220',
  steel: '#8c9590',
  chalk: '#eef2ef',
  clover: '#1fbf3f',
  cloverDeep: '#0f8a2a',
  violet: '#6b2cf5',
} as const;

export interface BrandVoice {
  tone: string;
  doRules: string[];
  dontRules: string[];
  bannedPhrases: string[];
  approvedClaims: string[];
  hashtags: string[];
  defaultCta: string;
}

/** Defaults; the owner's edits live in the `brand_voice` row and override these. */
export const DEFAULT_VOICE: BrandVoice = {
  tone: 'Straight-talking Charleston diesel techs. Confident, plain, never hype.',
  doRules: [
    'Lead with the truck and the job, not the shop.',
    'Use real numbers only: dyno sheets, prices from the store, open bays.',
    'Short sentences. Verb-first calls to action.',
    'Say results vary whenever power numbers appear.',
  ],
  dontRules: [
    'Never mention emissions removal, deletes, defeat devices or off-road-only parts.',
    'Never invent reviews, customers, awards or years in business.',
    'Never offer anything in exchange for a review.',
    'No ALL CAPS shouting, no more than one exclamation mark.',
  ],
  bannedPhrases: ['delete', 'straight pipe', 'race pipe', 'off-road only', 'no inspections'],
  approvedClaims: ['Diesel-only shop', 'Duramax, Powerstroke and Cummins', 'Parts supplied and installed', 'Real dyno numbers'],
  hashtags: ['#LuckyDiesel', '#CharlestonSC', '#DieselTrucks'],
  defaultCta: 'Book a bay',
};

export const PLATFORM_NAMES: Record<PlatformId, string> = { duramax: 'Duramax', powerstroke: 'Powerstroke', cummins: 'Cummins' };

export const PLATFORM_HASHTAGS: Record<PlatformId, string[]> = {
  duramax: ['#Duramax', '#ChevyDiesel', '#GMCSierra'],
  powerstroke: ['#Powerstroke', '#FordDiesel', '#SuperDuty'],
  cummins: ['#Cummins', '#RamTrucks', '#CumminsPower'],
};

export const LOCAL_HASHTAGS = ['#Charleston', '#Lowcountry', '#SummervilleSC', '#MountPleasantSC'];

export interface CopyLimits {
  headline: number;
  longHeadline: number | null;
  primary: number;
  description: number | null;
  ctas: readonly string[];
}

/** Character limits from each platform's ad specs (see docs/research/marketing-tech.md §2). */
export const AD_LIMITS: Record<AdPlatform, CopyLimits> = {
  meta: { headline: 40, longHeadline: null, primary: 125, description: 30, ctas: ['BOOK_NOW', 'GET_QUOTE', 'LEARN_MORE', 'SHOP_NOW', 'CALL_NOW'] },
  google_pmax: { headline: 30, longHeadline: 90, primary: 90, description: 60, ctas: ['BOOK_NOW', 'GET_QUOTE', 'LEARN_MORE', 'SHOP_NOW', 'CALL_NOW'] },
  google_search: { headline: 30, longHeadline: null, primary: 90, description: 90, ctas: ['LEARN_MORE'] },
  tiktok: { headline: 40, longHeadline: null, primary: 100, description: null, ctas: ['BOOK_NOW', 'LEARN_MORE', 'SHOP_NOW', 'CONTACT_US'] },
};

export const CTA_BY_GOAL: Record<AdGoal, readonly string[]> = {
  leads: ['GET_QUOTE', 'BOOK_NOW', 'LEARN_MORE'],
  bookings: ['BOOK_NOW', 'CALL_NOW', 'GET_QUOTE'],
  traffic: ['LEARN_MORE', 'SHOP_NOW'],
  awareness: ['LEARN_MORE'],
  sales: ['SHOP_NOW', 'LEARN_MORE'],
};

export const CTA_LABELS: Record<string, string> = {
  BOOK_NOW: 'Book now',
  GET_QUOTE: 'Get a quote',
  LEARN_MORE: 'Learn more',
  SHOP_NOW: 'Shop now',
  CALL_NOW: 'Call now',
  CONTACT_US: 'Contact us',
};

export const SOCIAL_LIMITS: Record<SocialPlatform, { caption: number; hashtags: number }> = {
  instagram: { caption: 2200, hashtags: 30 },
  facebook: { caption: 5000, hashtags: 5 },
  gbp: { caption: 1500, hashtags: 0 },
  tiktok: { caption: 2200, hashtags: 8 },
};

export const SHOP_FACTS = {
  name: BUSINESS.name,
  city: BUSINESS.city,
  phone: BUSINESS.phoneDisplay,
  area: BUSINESS.areaServed,
} as const;

/** Trims to a limit at a word boundary, without dangling punctuation. */
export function fitText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : clean.slice(0, max)).replace(/[\s,;:–—-]+$/, '');
  return base.length <= max ? base : base.slice(0, max);
}
