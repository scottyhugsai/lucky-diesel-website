import type { AdFormat, AdGoal, AdPlatform, CampaignPlatform, SeasonKey, SocialPlatform } from '@/lib/marketing/content/types';

/* Labels, tones and small helpers shared by the ads, social and content screens. Pure. */

export type Tone = 'neutral' | 'info' | 'warn' | 'good' | 'bad' | 'violet';

export interface GoalOption {
  key: 'bookings' | 'parts' | 'tow' | 'dyno' | 'offer';
  label: string;
  hint: string;
  goal: AdGoal;
  /** Season used when the owner picks "auto-design". Null → current season. */
  season: SeasonKey | null;
}

export const GOAL_OPTIONS: readonly GoalOption[] = [
  { key: 'bookings', label: 'Bookings', hint: 'Fill open bays this week.', goal: 'bookings', season: null },
  { key: 'parts', label: 'Parts sales', hint: 'Sell parts from the store.', goal: 'sales', season: null },
  { key: 'tow', label: 'Tow season', hint: 'Tow-ready checks before trips.', goal: 'bookings', season: 'tow_season' },
  { key: 'dyno', label: 'Dyno day', hint: 'Fill dyno pull slots.', goal: 'leads', season: 'dyno_day' },
  { key: 'offer', label: 'Offer', hint: 'Push a live deal.', goal: 'leads', season: null },
];

export const SOURCE_KINDS = ['product', 'build', 'offer', 'auto'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const AD_PLATFORMS: readonly AdPlatform[] = ['meta', 'google_pmax', 'google_search', 'tiktok'];

export const AD_PLATFORM_LABEL: Record<AdPlatform, string> = {
  meta: 'Meta (FB + IG)',
  google_pmax: 'Google PMax',
  google_search: 'Google Search',
  tiktok: 'TikTok',
};

export const CAMPAIGN_PLATFORM_LABEL: Record<CampaignPlatform, string> = { meta: 'Meta', google: 'Google', tiktok: 'TikTok', lsa: 'Local Services' };

/** Which campaign a creative can run in. */
export const CAMPAIGN_FOR_CREATIVE: Record<AdPlatform, CampaignPlatform> = { meta: 'meta', google_pmax: 'google', google_search: 'google', tiktok: 'tiktok' };

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = ['instagram', 'facebook', 'gbp', 'tiktok'];
export const SOCIAL_LABEL: Record<SocialPlatform, string> = { instagram: 'IG', facebook: 'FB', gbp: 'GBP', tiktok: 'TikTok' };

export const FORMAT_LABEL: Record<AdFormat, string> = { '1:1': 'Square', '4:5': 'Feed', '9:16': 'Story', '1.91:1': 'Wide' };

const STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral',
  pending_approval: 'warn',
  approved: 'info',
  scheduled: 'violet',
  live: 'good',
  published: 'good',
  simulated: 'good',
  draft_handoff: 'info',
  paused: 'warn',
  completed: 'neutral',
  rejected: 'bad',
  failed: 'bad',
  archived: 'neutral',
  pending: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Needs approval',
  draft_handoff: 'In TikTok inbox',
  simulated: 'Posted (demo)',
  published: 'Published',
};

export function statusTone(status: string): Tone {
  return STATUS_TONE[status] ?? 'neutral';
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

export function creativeImage(id: string, format: AdFormat): string {
  return `/api/marketing/creative/${id}/image?format=${encodeURIComponent(format)}`;
}

export function ctaLabel(cta: string): string {
  return cta.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export const ADS_TABS = [
  { href: '/admin/marketing/ads', label: 'Studio' },
  { href: '/admin/marketing/ads/approvals', label: 'Approvals' },
  { href: '/admin/marketing/ads/campaigns', label: 'Campaigns' },
  { href: '/admin/marketing/ads/performance', label: 'Performance' },
  { href: '/admin/marketing/ads/autopilot', label: 'Autopilot' },
] as const;

export const CONTENT_TABS = [
  { href: '/admin/marketing/content', label: 'SEO + listings' },
  { href: '/admin/marketing/content/copilot', label: 'Copilot' },
  { href: '/admin/marketing/content/templates', label: 'Templates' },
  { href: '/admin/marketing/content/connections', label: 'Connections' },
] as const;

export const SOCIAL_TABS = [
  { href: '/admin/marketing/social', label: 'Calendar' },
  { href: '/admin/marketing/social/new', label: 'New post' },
  { href: '/admin/marketing/social/releases', label: 'Releases' },
  { href: '/admin/marketing/ads/approvals', label: 'Approvals' },
] as const;
