/**
 * Pure promotion math: invoice discount totals, pricing programs (tier perks,
 * fleet volume, military), points, single-use codes, offer lint, leaderboard
 * names and report roll-ups. Money in integer cents. No I/O.
 */

import { CODE_ALPHABET } from './rewards';
import type { LoyaltyTier } from './segment-rules';

export type DiscountKind = 'offer' | 'points' | 'referral' | 'military' | 'fleet' | 'tier';

// ─── Invoice totals ────────────────────────────────────────────────────────

/**
 * Totals after a discount. The discount is capped at the subtotal and tax
 * shrinks in proportion to the discounted base (tax only ever falls).
 */
export function discountedTotals(input: { subtotalCents: number; preDiscountTaxCents: number; discountCents: number }): { discountCents: number; taxCents: number; totalCents: number } {
  const subtotal = Math.max(0, Math.round(input.subtotalCents));
  const discount = Math.min(subtotal, Math.max(0, Math.round(input.discountCents)));
  const baseTax = Math.max(0, Math.round(input.preDiscountTaxCents));
  const taxCents = subtotal === 0 ? 0 : Math.round((baseTax * (subtotal - discount)) / subtotal);
  return { discountCents: discount, taxCents, totalCents: subtotal - discount + taxCents };
}

export function percentOf(cents: number, percent: number): number {
  if (cents <= 0 || percent <= 0) return 0;
  return Math.round((cents * Math.min(100, percent)) / 100);
}

/** Labor total from a frozen invoice line snapshot (unknown JSON). */
export function laborCentsFromSnapshot(snapshot: unknown): number {
  if (!Array.isArray(snapshot)) return 0;
  return snapshot.reduce<number>((sum, raw) => {
    if (!raw || typeof raw !== 'object') return sum;
    const row = raw as Record<string, unknown>;
    const qty = Number(row.quantity);
    const price = Number(row.unit_price_cents);
    if (row.kind !== 'labor' || !Number.isFinite(qty) || !Number.isFinite(price)) return sum;
    return sum + Math.round(qty * price);
  }, 0);
}

/** Parts cost from a snapshot (line_items rows carry unit_cost_cents). */
export function costCentsFromSnapshot(snapshot: unknown): number {
  if (!Array.isArray(snapshot)) return 0;
  return snapshot.reduce<number>((sum, raw) => {
    if (!raw || typeof raw !== 'object') return sum;
    const row = raw as Record<string, unknown>;
    const qty = Number(row.quantity);
    const cost = Number(row.unit_cost_cents ?? 0);
    return Number.isFinite(qty) && Number.isFinite(cost) ? sum + Math.round(qty * cost) : sum;
  }, 0);
}

// ─── Pricing programs ──────────────────────────────────────────────────────

export type PerkTier = Exclude<LoyaltyTier, 'stock'>;
export interface TierPerk { perk: string; laborPercent: number }
export type TierPerks = Record<PerkTier, TierPerk>;
export interface FleetTier { minTrucks: number; laborPercent: number }

export const DEFAULT_TIER_PERKS: TierPerks = {
  stage_1: { perk: 'Priority booking', laborPercent: 0 },
  stage_2: { perk: '5% off labor', laborPercent: 5 },
  full_build: { perk: '10% off labor + dyno re-check', laborPercent: 10 },
};
export const DEFAULT_FLEET_TIERS: readonly FleetTier[] = [{ minTrucks: 3, laborPercent: 5 }, { minTrucks: 10, laborPercent: 10 }];
export const MAX_PROGRAM_PERCENT = 50;

const clampPercent = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_PROGRAM_PERCENT ? value : null);

export function parseTierPerks(value: unknown): TierPerks {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const read = (tier: PerkTier): TierPerk => {
    const row = v[tier] && typeof v[tier] === 'object' ? (v[tier] as Record<string, unknown>) : {};
    const perk = typeof row.perk === 'string' && row.perk.trim() ? row.perk.trim().slice(0, 80) : DEFAULT_TIER_PERKS[tier].perk;
    return { perk, laborPercent: clampPercent(row.labor_percent) ?? DEFAULT_TIER_PERKS[tier].laborPercent };
  };
  return { stage_1: read('stage_1'), stage_2: read('stage_2'), full_build: read('full_build') };
}

export function tierPerksToJson(perks: TierPerks): Record<PerkTier, { perk: string; labor_percent: number }> {
  const out = (t: PerkTier) => ({ perk: perks[t].perk, labor_percent: perks[t].laborPercent });
  return { stage_1: out('stage_1'), stage_2: out('stage_2'), full_build: out('full_build') };
}

export function parseFleetTiers(value: unknown): FleetTier[] {
  if (!Array.isArray(value)) return [...DEFAULT_FLEET_TIERS];
  return value
    .flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return [];
      const row = raw as Record<string, unknown>;
      const min = typeof row.min_trucks === 'number' && Number.isInteger(row.min_trucks) && row.min_trucks >= 1 ? row.min_trucks : null;
      const pct = clampPercent(row.labor_percent);
      return min && pct !== null ? [{ minTrucks: min, laborPercent: pct }] : [];
    })
    .sort((a, b) => a.minTrucks - b.minTrucks);
}

/** Highest fleet tier the truck count reaches; 0 when none. */
export function fleetPercentFor(truckCount: number, tiers: readonly FleetTier[]): number {
  return tiers.filter((t) => truckCount >= t.minTrucks).reduce((best, t) => Math.max(best, t.laborPercent), 0);
}

// ─── Points ────────────────────────────────────────────────────────────────

/** Points to spend and their value, capped by balance and what is left to discount. */
export function pointsRedemption(input: { requested: number; balance: number; pointValueCents: number; remainingCents: number }): { points: number; cents: number } {
  if (input.pointValueCents <= 0 || input.remainingCents <= 0) return { points: 0, cents: 0 };
  const affordable = Math.floor(input.remainingCents / input.pointValueCents);
  const points = Math.max(0, Math.min(Math.floor(input.requested), input.balance, affordable));
  return { points, cents: points * input.pointValueCents };
}

/** Points worth a cash reward (e.g. a $50 referral credit). */
export function pointsForCredit(creditCents: number, pointValueCents: number): number {
  if (creditCents <= 0 || pointValueCents <= 0) return 0;
  return Math.ceil(creditCents / pointValueCents);
}

// ─── Codes ─────────────────────────────────────────────────────────────────

/** `FALL10-7KQ2MX` style single-use code. */
export function singleUseCode(offerCode: string, random: () => number = Math.random, length = 6): string {
  const stem = offerCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'LD';
  let suffix = '';
  for (let i = 0; i < length; i += 1) suffix += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)] ?? 'X';
  return `${stem}-${suffix}`;
}

/** `Blue Water Boats` → `BLUEWATER-REF`. */
export function partnerCodeStem(name: string): string {
  const stem = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  return `${stem.length >= 2 ? stem : 'PARTNER'}-REF`;
}

// ─── Offer lint ────────────────────────────────────────────────────────────

export interface OfferDraft {
  kind: 'percent' | 'amount' | 'free_service';
  value: number;
  name: string;
  description: string | null;
  terms: string | null;
  endsAt: string | null;
  minSpendCents: number;
  maxRedemptions: number | null;
  bundleItems: readonly string[];
  bundlePriceCents: number | null;
  giftItem: string | null;
  creatorName: string | null;
}

export interface OfferLintIssue { severity: 'block' | 'warn'; rule: string; message: string }

/** Offer-specific claim rules layered on the shared copy check. */
export function lintOffer(o: OfferDraft): OfferLintIssue[] {
  const issues: OfferLintIssue[] = [];
  const copy = [o.name, o.description ?? ''].join(' ');
  const terms = o.terms?.trim() ?? '';
  if (!terms) issues.push({ severity: 'block', rule: 'terms_required', message: 'Add terms (what’s included, limits).' });
  if (!o.endsAt) issues.push({ severity: 'warn', rule: 'no_expiry', message: 'No expiry date. Open-ended offers are hard to stop.' });
  if (/\b(?:starting at|starts at|as low as|from \$\d)/i.test(copy) && !/\b(?:varies|depends|plus|extra|excludes?|per truck|parts)\b/i.test(terms)) {
    issues.push({ severity: 'warn', rule: 'starting_at', message: '“Starting at” needs terms saying what changes the price.' });
  }
  if (/\bfree\b/i.test(copy) && (o.minSpendCents > 0 || o.giftItem) && !/\b(?:with|purchase|spend|minimum|min)\b/i.test(terms)) {
    issues.push({ severity: 'warn', rule: 'free_conditions', message: '“Free” with a purchase must say so in the terms.' });
  }
  if (/\b(?:unlimited|while supplies last|limited time)\b/i.test(copy) && !o.maxRedemptions && !o.endsAt) {
    issues.push({ severity: 'warn', rule: 'bait_scarcity', message: 'Scarcity words need a real limit or end date.' });
  }
  if (o.kind === 'amount' && o.minSpendCents > 0 && o.value >= o.minSpendCents) {
    issues.push({ severity: 'block', rule: 'value_vs_min_spend', message: 'Discount is as big as the minimum spend.' });
  }
  if (o.kind === 'percent' && o.value > 40) issues.push({ severity: 'warn', rule: 'deep_percent', message: 'Over 40% off. Check the margin.' });
  if (o.bundleItems.length > 0) {
    if (o.bundleItems.length < 2) issues.push({ severity: 'block', rule: 'bundle_items', message: 'A bundle needs at least two items.' });
    if (o.bundlePriceCents === null || o.value <= 0) issues.push({ severity: 'block', rule: 'bundle_price', message: 'Bundle price must be below the separate price.' });
  }
  if (o.creatorName && !/#ad\b|paid partner|sponsored/i.test(terms)) {
    issues.push({ severity: 'warn', rule: 'creator_disclosure', message: 'Creator codes: terms should say “paid partner” (FTC).' });
  }
  return issues;
}

// ─── Names, reports, schedules ─────────────────────────────────────────────

/** “Cody Marsh” → “Cody M.” for public recognition. */
export function leaderboardName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Customer';
  const first = parts[0]!.slice(0, 20);
  const last = parts.length > 1 ? parts[parts.length - 1]!.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() : '';
  return last ? `${first} ${last}.` : first;
}

export interface StatementRow { month: string; referred: number; rewarded: number; owedCents: number }

/** Monthly partner statement (month in shop time, newest first). */
export function monthlyStatement(rows: readonly { createdAt: string; status: string; rewardCents: number; rewardedAt: string | null }[], timeZone = 'America/New_York'): StatementRow[] {
  const monthOf = (iso: string) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(iso));
    return `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}`;
  };
  const map = new Map<string, StatementRow>();
  const row = (m: string) => map.get(m) ?? { month: m, referred: 0, rewarded: 0, owedCents: 0 };
  for (const r of rows) {
    if (r.status === 'void') continue;
    const created = row(monthOf(r.createdAt));
    map.set(created.month, { ...created, referred: created.referred + 1 });
    if (r.status === 'rewarded' && r.rewardedAt) {
      const paid = row(monthOf(r.rewardedAt));
      map.set(paid.month, { ...paid, rewarded: paid.rewarded + 1, owedCents: paid.owedCents + r.rewardCents });
    }
  }
  return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
}

export interface RoiInput { discountCents: number; invoiceSubtotalCents: number; invoiceCostCents: number }
export interface Roi { redemptions: number; discountCents: number; revenueCents: number; marginCents: number; roi: number | null }

/** Revenue = invoice subtotals after discount; margin also subtracts parts cost. ROI = margin / discount. */
export function promoRoi(rows: readonly RoiInput[]): Roi {
  const discountCents = rows.reduce((t, r) => t + r.discountCents, 0);
  const revenueCents = rows.reduce((t, r) => t + Math.max(0, r.invoiceSubtotalCents - r.discountCents), 0);
  const marginCents = revenueCents - rows.reduce((t, r) => t + r.invoiceCostCents, 0);
  return { redemptions: rows.length, discountCents, revenueCents, marginCents, roi: discountCents > 0 ? Math.round((marginCents / discountCents) * 10) / 10 : null };
}

export function creatorCommissionCents(revenueCents: number, percent: number): number {
  return percentOf(revenueCents, percent);
}

const DAY_MS = 86_400_000;

/** Offers ending within the window (default 48h) from now. */
export function isExpiringSoon(endsAt: string | null, now: Date, windowMs = 2 * DAY_MS): boolean {
  if (!endsAt) return false;
  const end = Date.parse(endsAt);
  return end > now.getTime() && end - now.getTime() <= windowMs;
}

/**
 * Who to ask for a referral: customers with a paid job 3–10 days ago or a
 * 9–10 survey score in the last 10 days, minus anyone with a 0–6 score in the
 * last 30 days. Reviews never factor in. One ask per customer per half-year.
 */
export function referralAskTargets(input: {
  now: Date;
  paid: readonly { customerId: string; paidAt: string }[];
  nps: readonly { customerId: string; score: number; respondedAt: string }[];
}): { customerId: string; reason: 'paid_job' | 'promoter'; discriminator: string }[] {
  const t = input.now.getTime();
  const within = (iso: string, minDays: number, maxDays: number) => {
    const age = t - Date.parse(iso);
    return age >= minDays * DAY_MS && age <= maxDays * DAY_MS;
  };
  const unhappy = new Set(input.nps.filter((n) => n.score <= 6 && within(n.respondedAt, 0, 30)).map((n) => n.customerId));
  const bucket = `${input.now.getUTCFullYear()}h${input.now.getUTCMonth() < 6 ? 1 : 2}`;
  const out = new Map<string, 'paid_job' | 'promoter'>();
  for (const n of input.nps) if (n.score >= 9 && within(n.respondedAt, 0, 10)) out.set(n.customerId, 'promoter');
  for (const p of input.paid) if (within(p.paidAt, 3, 10) && !out.has(p.customerId)) out.set(p.customerId, 'paid_job');
  return [...out].filter(([id]) => !unhappy.has(id)).map(([customerId, reason]) => ({ customerId, reason, discriminator: `ask:${bucket}` }));
}

export const TIER_NAME: Record<LoyaltyTier, string> = { stock: 'Stock', stage_1: 'Stage 1', stage_2: 'Stage 2', full_build: 'Full build' };
