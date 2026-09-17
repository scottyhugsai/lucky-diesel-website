import type { AdFormat, SocialPlatform } from '../types';

/** Connection rows in `channel_connections`. */
export type ConnectionPlatform = 'meta_ads' | 'google_ads' | 'tiktok_ads' | 'lsa' | 'instagram' | 'facebook' | 'gbp' | 'tiktok';
export type ConnectionStatus = 'not_connected' | 'demo' | 'connected' | 'expired' | 'error' | 'revoked';

/** Decrypted credentials. Server-only; never serialise to a client. */
export interface Credentials {
  accessToken: string;
  refreshToken: string | null;
  externalAccountId: string | null;
}

export type AdapterMode = 'demo' | 'live';

export interface ResolvedConnection {
  id: string | null;
  platform: ConnectionPlatform;
  status: ConnectionStatus;
  mode: AdapterMode;
  /** Why this connection runs in demo mode. */
  demoReason: string | null;
  credentials: Credentials | null;
}

export interface AdVariantPayload {
  variantId: string;
  headline: string;
  longHeadline: string | null;
  primaryText: string;
  description: string | null;
  cta: string;
  format: AdFormat;
  /** Public PNG URL of the rendered creative. */
  imageUrl: string;
  landingUrl: string;
}

export interface AdCampaignPayload {
  campaignId: string;
  name: string;
  objective: 'leads' | 'traffic' | 'calls' | 'awareness' | 'sales';
  dailyBudgetCents: number;
  startsOn: string;
  endsOn: string;
  /** Radius targeting around the shop, in miles. */
  radiusMiles: number;
  latitude: number;
  longitude: number;
}

export interface AdPublishRequest {
  campaign: AdCampaignPayload;
  variants: AdVariantPayload[];
  /** Idempotency key: retries with the same key must not create duplicates. */
  attemptKey: string;
}

export interface AdPublishResult {
  externalIds: Record<string, string>;
  /** Every live adapter creates objects PAUSED; activation is a separate, second step. */
  statusOnPlatform: 'PAUSED' | 'SIMULATED_PAUSED';
  simulated: boolean;
  requestPreview: Record<string, unknown>;
}

export interface DailyMetrics {
  date: string;
  impressions: number;
  clicks: number;
  spendCents: number;
  leads: number;
  conversions: number;
  conversionValueCents: number;
}

export interface AdAdapter {
  platform: ConnectionPlatform;
  publish(request: AdPublishRequest): Promise<AdPublishResult>;
  setStatus(externalIds: Record<string, string>, status: 'ACTIVE' | 'PAUSED'): Promise<void>;
  insights(externalIds: Record<string, string>, date: string, dailyBudgetCents: number): Promise<DailyMetrics | null>;
}

export interface PostPublishRequest {
  postId: string;
  platform: SocialPlatform;
  caption: string;
  imageUrl: string | null;
  linkUrl: string | null;
  scheduledFor: Date | null;
  /** GBP offer fields, IG media type and similar. */
  options: Record<string, unknown>;
}

export interface PostPublishResult {
  externalId: string | null;
  permalink: string | null;
  status: 'published' | 'simulated' | 'draft_handoff' | 'scheduled';
  simulated: boolean;
  requestPreview: Record<string, unknown>;
}

export interface PostAdapter {
  platform: SocialPlatform;
  publish(request: PostPublishRequest): Promise<PostPublishResult>;
}

export class ChannelError extends Error {
  constructor(message: string, readonly platform: ConnectionPlatform, readonly retryable = false) {
    super(message);
    this.name = 'ChannelError';
  }
}
