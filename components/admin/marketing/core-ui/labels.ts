/* Shared labels and tones for the marketing core screens. Safe on client and server. */

export type Tone = 'neutral' | 'info' | 'warn' | 'good' | 'bad' | 'violet';

export const STAGE_LABEL: Record<string, string> = {
  subscriber: 'Subscriber', lead: 'Lead', customer: 'Customer', repeat: 'Repeat', vip: 'VIP', lapsed: 'Lapsed', lost: 'Lost',
};

export const STAGE_TONE: Record<string, Tone> = {
  subscriber: 'neutral', lead: 'info', customer: 'good', repeat: 'good', vip: 'violet', lapsed: 'warn', lost: 'bad',
};

export const CAMPAIGN_STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral', scheduled: 'info', sending: 'good', sent: 'good', active: 'good', paused: 'warn', archived: 'neutral',
};

export const KIND_LABEL: Record<string, string> = { broadcast: 'Broadcast', drip: 'Drip', lifecycle: 'Lifecycle' };

export const SOURCE_LABEL: Record<string, string> = {
  google: 'Google', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', bing: 'Bing', youtube: 'YouTube',
  referral: 'Referral', email: 'Email', sms: 'SMS', direct: 'Direct', other: 'Other', website: 'Website', walk_in: 'Walk-in',
};

export const PLATFORM_OPTIONS = [
  { value: 'duramax', label: 'Duramax' },
  { value: 'powerstroke', label: 'Powerstroke' },
  { value: 'cummins', label: 'Cummins' },
] as const;

export const SERVICE_LABEL: Record<string, string> = {
  tune: 'Tune', turbo: 'Turbo', injectors: 'Injectors', fuel: 'Fuel system', exhaust: 'Exhaust', transmission: 'Transmission',
  maintenance: 'Maintenance', diagnostics: 'Diagnostics', head_studs: 'Head studs', engine: 'Engine build',
};

export const TIER_LABEL: Record<string, string> = { stock: 'Stock', stage_1: 'Stage 1', stage_2: 'Stage 2', full_build: 'Full build' };

export const EVENT_LABEL: Record<string, string> = {
  'marketing.win_back_6m': 'No visit in 6 months',
  'marketing.win_back_12m': 'No visit in 12 months',
  'service.due': 'Service due by mileage',
  'marketing.tune_follow_up': '3 days after a tune',
  'marketing.dyno_recheck': '30 days after a tune',
  'marketing.seasonal.towing_season': 'Towing season opens',
  'marketing.seasonal.hurricane_prep': 'Hurricane prep window',
  'marketing.seasonal.winter_diesel': 'Winter diesel window',
  'marketing.birthday': 'Birthday',
  'marketing.customer_anniversary': 'Customer anniversary',
  'marketing.build_plan_abandoned': 'Build plan not booked',
  'marketing.store_checkout_click': 'Store checkout, no booking',
  'marketing.referral_created': 'Referral made',
  'marketing.referral_rewarded': 'Referral rewarded',
  'marketing.review_detractor': 'Low survey score',
  'marketing.fleet_pm_due': 'Fleet PM due',
  'marketing.dyno_day_invite': 'Dyno day invite',
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return 'Direct';
  return SOURCE_LABEL[source] ?? source.charAt(0).toUpperCase() + source.slice(1).replace(/_/g, ' ');
}

export function pct(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;
}

export function compact(value: number): string {
  return value >= 10_000 ? `${Math.round(value / 1000)}k` : value.toLocaleString('en-US');
}

export function hourLabel(hour: number): string {
  const h = hour % 24;
  return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;
}
