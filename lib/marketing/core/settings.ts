import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/lib/db/database.types';
import { BUSINESS } from '@/lib/site';
import { DEFAULT_QUIET_END_HOUR, DEFAULT_QUIET_START_HOUR, DEFAULT_TIME_ZONE } from './policy';
import { DEFAULT_TIER_THRESHOLDS, parseTierThresholds, type TierThresholds } from './rewards';

export type Db = SupabaseClient<Database>;

export interface MarketingSettings {
  senderName: string;
  senderEmail: string | null;
  replyToEmail: string | null;
  postalAddress: string | null;
  smsBusinessName: string;
  timeZone: string;
  quietHoursStart: number;
  quietHoursEnd: number;
  smsMaxPerWeek: number;
  emailMaxPerWeek: number;
  seasonal: Record<string, boolean>;
  winbackMonths: number[];
  referrerRewardCents: number;
  refereeDiscountCents: number;
  loyaltyPointsPerDollar: number;
  tierThresholds: TierThresholds;
  missedCallTextBack: boolean;
}

export const DEFAULT_MARKETING_SETTINGS: MarketingSettings = {
  senderName: BUSINESS.name,
  senderEmail: null,
  replyToEmail: null,
  postalAddress: null,
  smsBusinessName: BUSINESS.name,
  timeZone: DEFAULT_TIME_ZONE,
  quietHoursStart: DEFAULT_QUIET_START_HOUR,
  quietHoursEnd: DEFAULT_QUIET_END_HOUR,
  smsMaxPerWeek: 2,
  emailMaxPerWeek: 3,
  seasonal: { towing_season: true, winter_diesel: true, hurricane_prep: true },
  winbackMonths: [6, 12],
  referrerRewardCents: 5000,
  refereeDiscountCents: 2500,
  loyaltyPointsPerDollar: 1,
  tierThresholds: DEFAULT_TIER_THRESHOLDS,
  missedCallTextBack: true,
};

function toggles(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_MARKETING_SETTINGS.seasonal;
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'));
}

export function mapSettings(row: Tables<'marketing_settings'> | null): MarketingSettings {
  if (!row) return DEFAULT_MARKETING_SETTINGS;
  return {
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    replyToEmail: row.reply_to_email,
    postalAddress: row.postal_address,
    smsBusinessName: row.sms_business_name,
    timeZone: row.time_zone,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    smsMaxPerWeek: row.sms_max_per_week,
    emailMaxPerWeek: row.email_max_per_week,
    seasonal: toggles(row.seasonal_toggles),
    winbackMonths: row.winback_months,
    referrerRewardCents: row.referrer_reward_cents,
    refereeDiscountCents: row.referee_discount_cents,
    loyaltyPointsPerDollar: row.loyalty_points_per_dollar,
    tierThresholds: parseTierThresholds(row.vip_thresholds_cents),
    missedCallTextBack: row.missed_call_text_back,
  };
}

/** Settings row 1, or safe defaults if it hasn't been created yet. */
export async function getMarketingSettings(db: Db): Promise<MarketingSettings> {
  const { data, error } = await db.from('marketing_settings').select('*').eq('id', 1).maybeSingle();
  if (error) console.error(`[marketing] could not load settings: ${error.message}`);
  return mapSettings(data);
}
