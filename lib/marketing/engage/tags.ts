import 'server-only';

/**
 * Third-party measurement tags. Each one is off until its id is in the env, and
 * even then only loads after the visitor accepts the matching cookie category.
 * Ids are public by design (they ship in the page), so they live in env, not code.
 */
export interface TagConfig {
  /** GA4 measurement id, e.g. G-XXXXXXX. Analytics consent. */
  ga4: string | null;
  /** Microsoft Clarity project id. Analytics consent. */
  clarity: string | null;
  /** Meta pixel id. Ads consent. */
  metaPixel: string | null;
  /** Google Ads conversion id, e.g. AW-123456789. Ads consent. */
  googleAds: string | null;
  /** Google Ads conversion label for the lead action. */
  googleAdsLeadLabel: string | null;
  /** TikTok pixel id. Ads consent. */
  tiktokPixel: string | null;
}

const ID = /^[A-Za-z0-9_-]{4,40}$/;

function id(value: string | undefined): string | null {
  const clean = value?.trim() ?? '';
  return clean && ID.test(clean) ? clean : null;
}

export function tagConfig(): TagConfig {
  return {
    ga4: id(process.env.GA4_MEASUREMENT_ID),
    clarity: id(process.env.CLARITY_PROJECT_ID),
    metaPixel: id(process.env.META_PIXEL_ID),
    googleAds: id(process.env.GOOGLE_ADS_CONVERSION_ID),
    googleAdsLeadLabel: id(process.env.GOOGLE_ADS_LEAD_LABEL),
    tiktokPixel: id(process.env.TIKTOK_PIXEL_ID),
  };
}

export function hasAnyTag(config: TagConfig): boolean {
  return Object.values(config).some(Boolean);
}
