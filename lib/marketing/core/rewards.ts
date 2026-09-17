/** Pure referral, loyalty and offer math. Money in integer cents. */

import type { LoyaltyTier } from './segment-rules';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

/** `CODY-7KQ2` style code from a name plus random characters. */
export function referralCode(fullName: string, random: () => number = Math.random, suffixLength = 4): string {
  const stem = fullName.split(/\s+/)[0]?.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'FRIEND';
  let suffix = '';
  for (let i = 0; i < suffixLength; i += 1) suffix += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)] ?? 'X';
  return `${stem.length >= 2 ? stem : 'FRIEND'}-${suffix}`;
}

export type TierThresholds = Record<Exclude<LoyaltyTier, 'stock'>, number>;

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = { stage_1: 100_000, stage_2: 500_000, full_build: 1_500_000 };
const TIER_ORDER: readonly LoyaltyTier[] = ['stock', 'stage_1', 'stage_2', 'full_build'];

export function parseTierThresholds(value: unknown): TierThresholds {
  if (!value || typeof value !== 'object') return DEFAULT_TIER_THRESHOLDS;
  const v = value as Record<string, unknown>;
  const read = (key: keyof TierThresholds) => (typeof v[key] === 'number' && Number.isFinite(v[key]) && (v[key] as number) >= 0 ? (v[key] as number) : DEFAULT_TIER_THRESHOLDS[key]);
  return { stage_1: read('stage_1'), stage_2: read('stage_2'), full_build: read('full_build') };
}

/** VIP tier by lifetime paid spend. */
export function tierForSpend(lifetimeSpendCents: number, thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS): LoyaltyTier {
  if (lifetimeSpendCents >= thresholds.full_build) return 'full_build';
  if (lifetimeSpendCents >= thresholds.stage_2) return 'stage_2';
  if (lifetimeSpendCents >= thresholds.stage_1) return 'stage_1';
  return 'stock';
}

export function isTierUpgrade(from: LoyaltyTier, to: LoyaltyTier): boolean {
  return TIER_ORDER.indexOf(to) > TIER_ORDER.indexOf(from);
}

/** Whole dollars × points per dollar. */
export function pointsForPayment(amountCents: number, pointsPerDollar: number): number {
  if (amountCents <= 0 || pointsPerDollar <= 0) return 0;
  return Math.floor(amountCents / 100) * pointsPerDollar;
}

export interface OfferLike {
  kind: 'percent' | 'amount' | 'free_service';
  value: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  per_customer_limit: number;
  min_spend_cents: number;
  segment_id: string | null;
}

export interface RedemptionContext {
  now: Date;
  subtotalCents: number;
  totalRedemptions: number;
  customerRedemptions: number;
  /** Whether the customer is in the offer's segment; ignored when the offer has none. */
  inSegment: boolean;
}

export type OfferCheck = { ok: true; discountCents: number } | { ok: false; reason: string };

export function discountFor(offer: Pick<OfferLike, 'kind' | 'value'>, subtotalCents: number): number {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  if (offer.kind === 'percent') return Math.min(subtotal, Math.round((subtotal * Math.min(100, offer.value)) / 100));
  return Math.min(subtotal, offer.value);
}

export function validateRedemption(offer: OfferLike, ctx: RedemptionContext): OfferCheck {
  if (!offer.active) return { ok: false, reason: 'This offer is no longer active.' };
  if (offer.starts_at && ctx.now < new Date(offer.starts_at)) return { ok: false, reason: 'This offer hasn’t started yet.' };
  if (offer.ends_at && ctx.now >= new Date(offer.ends_at)) return { ok: false, reason: 'This offer has expired.' };
  if (offer.max_redemptions !== null && ctx.totalRedemptions >= offer.max_redemptions) return { ok: false, reason: 'This offer has been fully redeemed.' };
  if (ctx.customerRedemptions >= offer.per_customer_limit) return { ok: false, reason: 'Already used the maximum number of times.' };
  if (ctx.subtotalCents < offer.min_spend_cents) return { ok: false, reason: `Requires a minimum spend of $${(offer.min_spend_cents / 100).toFixed(2)}.` };
  if (offer.segment_id && !ctx.inSegment) return { ok: false, reason: 'This offer isn’t available for this customer.' };
  return { ok: true, discountCents: discountFor(offer, ctx.subtotalCents) };
}

export interface ReferralLike {
  status: 'pending' | 'qualified' | 'rewarded' | 'void';
  referred_customer_id: string | null;
  created_at: string;
}

/**
 * A referral is rewarded on the referred customer's first paid invoice after
 * the referral was recorded. Returns the invoice that qualifies it, or null.
 */
export function qualifyingInvoice<T extends { customer_id: string; paid_at: string | null; status: string }>(referral: ReferralLike, invoices: readonly T[]): T | null {
  if (referral.status === 'rewarded' || referral.status === 'void' || !referral.referred_customer_id) return null;
  const created = Date.parse(referral.created_at);
  const paid = invoices
    .filter((i) => i.customer_id === referral.referred_customer_id && i.status === 'paid' && i.paid_at && Date.parse(i.paid_at) >= created)
    .sort((a, b) => Date.parse(a.paid_at!) - Date.parse(b.paid_at!));
  return paid[0] ?? null;
}
