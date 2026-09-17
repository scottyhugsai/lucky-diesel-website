/** Shared vocabulary for the marketing content engine. Mirrors the check constraints in 009_marketing_content.sql. */

export type Generator = 'demo' | 'ai';
export type AdPlatform = 'meta' | 'google_pmax' | 'google_search' | 'tiktok';
export type CampaignPlatform = 'meta' | 'google' | 'tiktok' | 'lsa';
export type AdGoal = 'leads' | 'bookings' | 'traffic' | 'awareness' | 'sales';
export type AdFormat = '1:1' | '4:5' | '9:16' | '1.91:1';
export type ImageTemplate = 'dyno' | 'product' | 'offer' | 'seasonal' | 'review' | 'before_after' | 'photo';
export type SocialPlatform = 'instagram' | 'facebook' | 'gbp' | 'tiktok';
export type ComplianceStatus = 'pass' | 'warn' | 'block';
export type PlatformId = 'duramax' | 'powerstroke' | 'cummins';

export const AD_FORMATS: readonly AdFormat[] = ['1:1', '4:5', '9:16', '1.91:1'];
export function isAdFormat(value: unknown): value is AdFormat {
  return typeof value === 'string' && (AD_FORMATS as readonly string[]).includes(value);
}

export const IMAGE_TEMPLATES: readonly ImageTemplate[] = ['dyno', 'product', 'offer', 'seasonal', 'review', 'before_after', 'photo'];

export const FORMAT_SIZE: Record<AdFormat, { width: number; height: number }> = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  '1.91:1': { width: 1200, height: 628 },
};

export interface ClaimIssue {
  term: string;
  reason: string;
  severity: 'block' | 'warn';
}

export interface ClaimsResult {
  ok: boolean;
  issues: ClaimIssue[];
}

/** A Shopify product, reduced to what ad copy needs. */
export interface ProductRef {
  handle: string;
  title: string;
  vendor: string;
  category: string;
  priceFromCents: number;
  image: string | null;
  platforms: PlatformId[];
  offRoadOnly: boolean;
}

/** A published build or a logged dyno result. Numbers are real shop data, never invented. */
export interface BuildRef {
  id: string;
  slug: string | null;
  title: string;
  vehicleLabel: string;
  platform: string;
  beforeHp: number | null;
  afterHp: number | null;
  beforeTorque: number | null;
  afterTorque: number | null;
  parts: string[];
  image: string | null;
  isSample: boolean;
}

export interface OfferRef {
  code: string | null;
  headline: string;
  valueLabel: string;
  terms: string;
  endsAt: string | null;
  landingSlug: string | null;
}

export type SeasonKey = 'tow_season' | 'hurricane_prep' | 'winter_ready' | 'spring_tune' | 'dyno_day' | 'holiday';

export interface ReviewRef {
  id: string;
  author: string;
  rating: number;
  body: string;
  source: string;
}

export type CreativeSubject =
  | { kind: 'product'; product: ProductRef }
  | { kind: 'build'; build: BuildRef }
  | { kind: 'dyno'; build: BuildRef }
  | { kind: 'offer'; offer: OfferRef }
  | { kind: 'season'; season: SeasonKey }
  | { kind: 'review'; review: ReviewRef };

export interface CreativeBrief {
  goal: AdGoal;
  platform: AdPlatform;
  subject: CreativeSubject;
  audience?: string;
  format?: AdFormat;
  /** Number of variants to produce (1–8, default 4). */
  count?: number;
  /** Stable seed so the same brief yields the same demo copy. */
  seed?: string;
}

export interface VariantDraft {
  label: string;
  hook: string;
  angle: string;
  headline: string;
  longHeadline: string | null;
  primaryText: string;
  description: string | null;
  cta: string;
  format: AdFormat;
  imageTemplate: ImageTemplate;
  imageParams: Record<string, string | number | null>;
  complianceStatus: ComplianceStatus;
  complianceIssues: ClaimIssue[];
  generator: Generator;
}
