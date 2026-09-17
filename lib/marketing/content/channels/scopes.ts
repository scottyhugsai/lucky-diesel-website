import type { ConnectionPlatform } from './types';

/**
 * What each platform needs before live mode can work. Shown on the admin
 * connection cards. Source: docs/research/marketing-tech.md §2–3 (2026-09-17).
 */
export interface PlatformRequirements {
  label: string;
  scopes: readonly string[];
  ownerSteps: readonly string[];
  typicalWait: string;
  /** What our adapter does once connected. */
  capability: string;
  readOnly: boolean;
}

export const PLATFORM_REQUIREMENTS: Record<ConnectionPlatform, PlatformRequirements> = {
  meta_ads: {
    label: 'Meta ads (Facebook + Instagram)',
    scopes: ['ads_management', 'ads_read', 'business_management', 'pages_read_engagement', 'pages_manage_ads'],
    ownerSteps: ['Business Portfolio with Business Verification', 'Ad account with a payment method', 'Page and IG professional account linked', 'Developer app with Marketing API (system user token)'],
    typicalWait: '1–3 weeks',
    capability: 'Creates campaign, ad set, creative and ad PAUSED; activation is a second owner click; daily insights sync.',
    readOnly: false,
  },
  google_ads: {
    label: 'Google Ads (Performance Max)',
    scopes: ['https://www.googleapis.com/auth/adwords'],
    ownerSteps: ['Google Ads account with billing (MCC recommended)', 'Google Cloud project OAuth consent screen', 'API access level (Explorer/Basic) approved for the Cloud project'],
    typicalWait: 'Days to 3 weeks',
    capability: 'Builds budget, PAUSED PMax campaign and asset group in one mutate; GAQL metrics sync.',
    readOnly: false,
  },
  tiktok_ads: {
    label: 'TikTok ads',
    scopes: ['Ad Account Management', 'Ads Management', 'Creative Management', 'Reporting'],
    ownerSteps: ['TikTok for Business developer app approved for Marketing API', 'TikTok Ads Manager advertiser account', 'OAuth to the advertiser'],
    typicalWait: '1–4 weeks',
    capability: 'Creates DISABLED campaign and ad group, uploads the image by URL, creates the ad disabled.',
    readOnly: false,
  },
  lsa: {
    label: 'Local Services Ads',
    scopes: ['https://www.googleapis.com/auth/adwords'],
    ownerSteps: ['LSA profile, licenses, insurance and background checks (manual in the LSA UI)', 'Linked Google Ads account'],
    typicalWait: '2–6 weeks',
    capability: 'Read-only: imports LSA leads and spend. Ads cannot be created by API.',
    readOnly: true,
  },
  instagram: {
    label: 'Instagram posts',
    scopes: ['instagram_business_basic', 'instagram_business_content_publish'],
    ownerSteps: ['Instagram professional (Business/Creator) account', 'App role on the Meta app (no review needed for your own account)'],
    typicalWait: 'About a day',
    capability: 'Creates a media container from the public image URL, waits for FINISHED, then publishes at the scheduled time.',
    readOnly: false,
  },
  facebook: {
    label: 'Facebook Page posts',
    scopes: ['pages_manage_posts', 'pages_read_engagement'],
    ownerSteps: ['Admin of the Lucky Diesel Page', 'Same Meta app as ads'],
    typicalWait: 'About a day',
    capability: 'Photo post with native scheduling (scheduled_publish_time, 10 min to 30 days out).',
    readOnly: false,
  },
  gbp: {
    label: 'Google Business Profile',
    scopes: ['https://www.googleapis.com/auth/business.manage'],
    ownerSteps: ['Verified Business Profile', 'GBP API access request form approved'],
    typicalWait: '1–3 weeks',
    capability: 'Local posts (STANDARD / OFFER / EVENT) with one photo; reviews list and reply. Q&A no longer exists.',
    readOnly: false,
  },
  tiktok: {
    label: 'TikTok posts',
    scopes: ['user.info.basic', 'video.upload'],
    ownerSteps: ['TikTok developer app with Content Posting API', 'Audit required for public direct posts (unaudited posts are private)'],
    typicalWait: 'Weeks for audit',
    capability: 'Sends the post to the TikTok inbox as a draft; the owner finishes it in the app.',
    readOnly: false,
  },
};
