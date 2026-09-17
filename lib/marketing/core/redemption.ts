import 'server-only';
import { money } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { redeemOffer } from './loyalty';
import {
  discountedTotals, fleetPercentFor, laborCentsFromSnapshot, parseFleetTiers, parseTierPerks, percentOf, pointsRedemption, TIER_NAME,
  type DiscountKind, type FleetTier, type TierPerks,
} from './promotions';
import type { LoyaltyTier } from './segment-rules';
import type { Db } from './settings';

/**
 * Discounts at invoice time: offer codes (shared or single-use), loyalty
 * points, referred-friend credit, tier perks, fleet volume and military /
 * first-responder pricing. Every amount is computed here, server-side; the
 * invoice's tax and total are recomputed from the discount lines.
 */

export interface ProgramSettings {
  pointValueCents: number;
  refereeDiscountCents: number;
  militaryLaborPercent: number;
  tierPerks: TierPerks;
  fleetTiers: FleetTier[];
}

export async function loadProgramSettings(db: Db): Promise<ProgramSettings> {
  const { data } = await db.from('marketing_settings').select('point_value_cents, referee_discount_cents, military_labor_percent, tier_perks, fleet_volume_tiers').eq('id', 1).maybeSingle();
  return {
    pointValueCents: data?.point_value_cents ?? 5,
    refereeDiscountCents: data?.referee_discount_cents ?? 2500,
    militaryLaborPercent: data?.military_labor_percent ?? 10,
    tierPerks: parseTierPerks(data?.tier_perks),
    fleetTiers: parseFleetTiers(data?.fleet_volume_tiers),
  };
}

export interface AppliedDiscount { id: string; kind: DiscountKind; label: string; amountCents: number; points: number; note: string | null }

export interface InvoiceDiscountState {
  editable: boolean;
  lockedReason: string | null;
  laborCents: number;
  applied: AppliedDiscount[];
  program: ProgramSettings;
  points: { balance: number; maxPoints: number };
  referral: { eligible: boolean; amountCents: number };
  tier: { tier: LoyaltyTier; perk: string; percent: number; amountCents: number };
  fleet: { name: string | null; trucks: number; percent: number; amountCents: number };
  military: { verifiedAt: string | null; note: string | null; percent: number; amountCents: number };
}

type InvoiceRow = { id: string; status: string; customer_id: string; work_order_id: string; subtotal_cents: number; tax_cents: number; pre_discount_tax_cents: number | null; line_snapshot: unknown };

async function loadInvoice(db: Db, invoiceId: string): Promise<{ invoice: InvoiceRow; payments: number } | null> {
  const [{ data: invoice }, { count }] = await Promise.all([
    db.from('invoices').select('id, status, customer_id, work_order_id, subtotal_cents, tax_cents, pre_discount_tax_cents, line_snapshot').eq('id', invoiceId).maybeSingle(),
    db.from('payments').select('id', { count: 'exact', head: true }).eq('invoice_id', invoiceId),
  ]);
  return invoice ? { invoice, payments: count ?? 0 } : null;
}

function lockReason(invoice: InvoiceRow, payments: number): string | null {
  if (invoice.status !== 'open') return `Invoice is ${invoice.status}.`;
  if (payments > 0) return 'Invoice has a payment.';
  return null;
}

async function referralEligible(db: Db, customerId: string, invoiceId: string): Promise<boolean> {
  const [{ data: referral }, { data: partner }, { data: used }, { count: paidBefore }] = await Promise.all([
    db.from('referrals').select('id').eq('referred_customer_id', customerId).neq('status', 'void').maybeSingle(),
    db.from('partner_referrals').select('id').eq('customer_id', customerId).neq('status', 'void').maybeSingle(),
    db.from('invoice_discounts').select('id, invoices!inner(customer_id)').eq('kind', 'referral').eq('invoices.customer_id', customerId).neq('invoice_id', invoiceId).limit(1),
    db.from('invoices').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).eq('status', 'paid'),
  ]);
  return Boolean(referral || partner) && !used?.length && (paidBefore ?? 0) === 0;
}

async function fleetFor(db: Db, customerId: string): Promise<{ name: string | null; trucks: number }> {
  const { data: customer } = await db.from('customers').select('fleet_account_id, fleet_accounts(name, active)').eq('id', customerId).maybeSingle();
  if (!customer?.fleet_account_id || !customer.fleet_accounts?.active) return { name: null, trucks: 0 };
  const { data: members } = await db.from('customers').select('id').eq('fleet_account_id', customer.fleet_account_id);
  const ids = (members ?? []).map((m) => m.id);
  const { count } = ids.length ? await db.from('vehicles').select('id', { count: 'exact', head: true }).in('customer_id', ids) : { count: 0 };
  return { name: customer.fleet_accounts.name, trucks: count ?? 0 };
}

export async function loadInvoiceDiscountState(invoiceId: string, db: Db = createAdminClient()): Promise<InvoiceDiscountState | null> {
  const loaded = await loadInvoice(db, invoiceId);
  if (!loaded) return null;
  const { invoice, payments } = loaded;
  const [program, { data: applied }, { data: account }, { data: customer }, eligible, fleet] = await Promise.all([
    loadProgramSettings(db),
    db.from('invoice_discounts').select('id, kind, label, amount_cents, points, note').eq('invoice_id', invoiceId).order('created_at'),
    db.from('loyalty_accounts').select('tier, points_balance').eq('customer_id', invoice.customer_id).maybeSingle(),
    db.from('customers').select('military_verified_at, military_verified_note').eq('id', invoice.customer_id).maybeSingle(),
    referralEligible(db, invoice.customer_id, invoiceId),
    fleetFor(db, invoice.customer_id),
  ]);
  const labor = laborCentsFromSnapshot(invoice.line_snapshot);
  const rows = (applied ?? []).map((a) => ({ id: a.id, kind: a.kind as DiscountKind, label: a.label, amountCents: a.amount_cents, points: a.points, note: a.note }));
  const remaining = Math.max(0, invoice.subtotal_cents - rows.reduce((t, r) => t + r.amountCents, 0));
  const tier = (account?.tier ?? 'stock') as LoyaltyTier;
  const tierPercent = tier === 'stock' ? 0 : program.tierPerks[tier].laborPercent;
  const fleetPercent = fleet.name ? fleetPercentFor(fleet.trucks, program.fleetTiers) : 0;
  const balance = account?.points_balance ?? 0;
  const lockedReason = lockReason(invoice, payments);
  return {
    editable: !lockedReason, lockedReason, laborCents: labor, applied: rows, program,
    points: { balance, maxPoints: pointsRedemption({ requested: balance, balance, pointValueCents: program.pointValueCents, remainingCents: remaining }).points },
    referral: { eligible: eligible && program.refereeDiscountCents > 0, amountCents: Math.min(program.refereeDiscountCents, remaining) },
    tier: { tier, perk: tier === 'stock' ? '' : program.tierPerks[tier].perk, percent: tierPercent, amountCents: Math.min(percentOf(labor, tierPercent), remaining) },
    fleet: { ...fleet, percent: fleetPercent, amountCents: Math.min(percentOf(labor, fleetPercent), remaining) },
    military: { verifiedAt: customer?.military_verified_at ?? null, note: customer?.military_verified_note ?? null, percent: program.militaryLaborPercent, amountCents: Math.min(percentOf(labor, program.militaryLaborPercent), remaining) },
  };
}

/** Recomputes discount, tax and total from the discount lines. Only touches open invoices. */
async function recomputeInvoiceTotals(db: Db, invoice: InvoiceRow): Promise<void> {
  const { data: lines } = await db.from('invoice_discounts').select('amount_cents').eq('invoice_id', invoice.id);
  const preTax = invoice.pre_discount_tax_cents ?? invoice.tax_cents;
  const totals = discountedTotals({ subtotalCents: invoice.subtotal_cents, preDiscountTaxCents: preTax, discountCents: (lines ?? []).reduce((t, l) => t + l.amount_cents, 0) });
  const { error } = await db.from('invoices').update({ discount_cents: totals.discountCents, tax_cents: totals.taxCents, total_cents: totals.totalCents, pre_discount_tax_cents: preTax }).eq('id', invoice.id).eq('status', 'open');
  if (error) throw new Error(`Could not update invoice totals: ${error.message}`);
}

export type DiscountInput =
  | { kind: 'offer'; code: string }
  | { kind: 'points'; points: number }
  | { kind: 'military'; verified: boolean; note: string | null }
  | { kind: 'referral' | 'tier' | 'fleet' };

export type DiscountResult = { ok: true; notice: string } | { ok: false; error: string };

interface Planned { label: string; amountCents: number; points?: number; note?: string | null; offerId?: string | null; offerCodeId?: string | null; redemptionId?: string | null; undo?: () => Promise<void> }

async function planDiscount(db: Db, invoice: InvoiceRow, state: InvoiceDiscountState, input: DiscountInput, actorId: string | null): Promise<Planned | { error: string }> {
  const remaining = Math.max(0, invoice.subtotal_cents - state.applied.reduce((t, r) => t + r.amountCents, 0));
  switch (input.kind) {
    case 'offer': {
      const result = await redeemOffer({ code: input.code, customerId: invoice.customer_id, subtotalCents: invoice.subtotal_cents, invoiceId: invoice.id, workOrderId: invoice.work_order_id, commit: true }, db);
      if (!result.ok) return { error: result.reason };
      const amount = Math.min(result.discountCents, remaining);
      if (!result.giftItem && amount <= 0) return { error: 'Nothing left to discount.' };
      if (amount !== result.discountCents && result.redemptionId) await db.from('offer_redemptions').update({ discount_cents: amount }).eq('id', result.redemptionId);
      const code = input.code.trim().toUpperCase();
      return {
        label: result.giftItem ? `Gift: ${result.giftItem} (${code})` : `${result.offerName} (${code})`, amountCents: amount,
        offerId: result.offerId, offerCodeId: result.offerCodeId, redemptionId: result.redemptionId,
        undo: () => reverseOffer(db, result.redemptionId ?? null, result.offerCodeId ?? null),
      };
    }
    case 'points': {
      const { data: account } = await db.from('loyalty_accounts').select('points_balance').eq('customer_id', invoice.customer_id).maybeSingle();
      const balance = account?.points_balance ?? 0;
      const plan = pointsRedemption({ requested: input.points, balance, pointValueCents: state.program.pointValueCents, remainingCents: remaining });
      if (plan.points <= 0) return { error: balance ? 'Nothing left to discount.' : 'No points to spend.' };
      const { data: spent } = await db.from('loyalty_accounts').update({ points_balance: balance - plan.points, updated_at: new Date().toISOString() }).eq('customer_id', invoice.customer_id).eq('points_balance', balance).select('customer_id');
      if (!spent?.length) return { error: 'Points balance changed. Try again.' };
      await db.from('loyalty_events').insert({ customer_id: invoice.customer_id, kind: 'redeem', points: -plan.points, invoice_id: invoice.id, note: 'Redeemed on invoice' });
      return { label: `${plan.points.toLocaleString('en-US')} points`, amountCents: plan.cents, points: plan.points, undo: () => refundPoints(db, invoice.customer_id, invoice.id, plan.points) };
    }
    case 'referral':
      if (!state.referral.eligible) return { error: 'Not a referred first job.' };
      return state.referral.amountCents > 0 ? { label: 'Referred friend', amountCents: state.referral.amountCents } : { error: 'Nothing left to discount.' };
    case 'tier':
      if (state.tier.percent <= 0) return { error: 'No labor discount on this tier.' };
      return state.tier.amountCents > 0 ? { label: `${TIER_NAME[state.tier.tier]} perk: ${state.tier.percent}% labor`, amountCents: state.tier.amountCents } : { error: 'No labor to discount.' };
    case 'fleet':
      if (state.fleet.percent <= 0) return { error: 'Fleet doesn’t reach a volume tier.' };
      return state.fleet.amountCents > 0 ? { label: `Fleet ${state.fleet.percent}% labor (${state.fleet.trucks} trucks)`, amountCents: state.fleet.amountCents } : { error: 'No labor to discount.' };
    case 'military': {
      if (state.military.percent <= 0) return { error: 'Military pricing is off.' };
      if (!state.military.verifiedAt) {
        if (!input.verified || !input.note) return { error: 'Tick “Verified” and note what you saw.' };
        await db.from('customers').update({ military_verified_at: new Date().toISOString(), military_verified_note: input.note }).eq('id', invoice.customer_id);
        await db.from('audit_log').insert({ actor_id: actorId, entity: 'customer', entity_id: invoice.customer_id, action: 'military_verified', data: { note: input.note } });
      }
      return state.military.amountCents > 0 ? { label: `Military / first responder: ${state.military.percent}% labor`, amountCents: state.military.amountCents, note: input.note } : { error: 'No labor to discount.' };
    }
  }
}

async function reverseOffer(db: Db, redemptionId: string | null, offerCodeId: string | null): Promise<void> {
  if (redemptionId) await db.from('offer_redemptions').delete().eq('id', redemptionId);
  if (offerCodeId) await db.from('offer_codes').update({ redeemed_at: null, invoice_id: null }).eq('id', offerCodeId);
}

async function refundPoints(db: Db, customerId: string, invoiceId: string, points: number): Promise<void> {
  const { data: account } = await db.from('loyalty_accounts').select('points_balance').eq('customer_id', customerId).maybeSingle();
  await db.from('loyalty_accounts').update({ points_balance: (account?.points_balance ?? 0) + points, updated_at: new Date().toISOString() }).eq('customer_id', customerId);
  await db.from('loyalty_events').insert({ customer_id: customerId, kind: 'adjust', points, invoice_id: invoiceId, note: 'Invoice discount removed' });
}

export async function applyInvoiceDiscount(invoiceId: string, input: DiscountInput, actorId: string | null, db: Db = createAdminClient()): Promise<DiscountResult> {
  const loaded = await loadInvoice(db, invoiceId);
  if (!loaded) return { ok: false, error: 'Invoice not found.' };
  const locked = lockReason(loaded.invoice, loaded.payments);
  if (locked) return { ok: false, error: `${locked} Discounts are locked.` };
  const state = await loadInvoiceDiscountState(invoiceId, db);
  if (!state) return { ok: false, error: 'Invoice not found.' };
  if (state.applied.some((a) => a.kind === input.kind)) return { ok: false, error: 'Already applied. Remove it first.' };

  const plan = await planDiscount(db, loaded.invoice, state, input, actorId);
  if ('error' in plan) return { ok: false, error: plan.error };
  const { error } = await db.from('invoice_discounts').insert({
    invoice_id: invoiceId, kind: input.kind, label: plan.label.slice(0, 160), amount_cents: plan.amountCents, points: plan.points ?? 0, note: plan.note ?? null,
    offer_id: plan.offerId ?? null, offer_code_id: plan.offerCodeId ?? null, redemption_id: plan.redemptionId ?? null, created_by: actorId,
  });
  if (error) {
    await plan.undo?.();
    return { ok: false, error: error.code === '23505' ? 'Already applied. Remove it first.' : 'Couldn’t save the discount.' };
  }
  await recomputeInvoiceTotals(db, loaded.invoice);
  await db.from('audit_log').insert({ actor_id: actorId, entity: 'invoice', entity_id: invoiceId, action: 'discount_applied', data: { kind: input.kind, amount_cents: plan.amountCents } });
  return { ok: true, notice: plan.amountCents ? `${plan.label}: −${money(plan.amountCents)}` : `${plan.label} added.` };
}

export async function removeInvoiceDiscount(invoiceId: string, discountId: string, actorId: string | null, db: Db = createAdminClient()): Promise<DiscountResult> {
  const loaded = await loadInvoice(db, invoiceId);
  if (!loaded) return { ok: false, error: 'Invoice not found.' };
  const locked = lockReason(loaded.invoice, loaded.payments);
  if (locked) return { ok: false, error: `${locked} Discounts are locked.` };
  const { data: row } = await db.from('invoice_discounts').delete().eq('id', discountId).eq('invoice_id', invoiceId).select('*').maybeSingle();
  if (!row) return { ok: false, error: 'Discount not found.' };
  if (row.kind === 'offer') await reverseOffer(db, row.redemption_id, row.offer_code_id);
  if (row.kind === 'points' && row.points > 0) await refundPoints(db, loaded.invoice.customer_id, invoiceId, row.points);
  await recomputeInvoiceTotals(db, loaded.invoice);
  await db.from('audit_log').insert({ actor_id: actorId, entity: 'invoice', entity_id: invoiceId, action: 'discount_removed', data: { kind: row.kind, amount_cents: row.amount_cents } });
  return { ok: true, notice: `Removed ${row.label}.` };
}

/** Applied when an invoice is created: the referred-friend credit on a first job. Never throws. */
export async function applyAutomaticDiscounts(invoiceId: string, actorId: string | null): Promise<void> {
  try {
    const state = await loadInvoiceDiscountState(invoiceId);
    if (state?.editable && state.referral.eligible && state.referral.amountCents > 0) await applyInvoiceDiscount(invoiceId, { kind: 'referral' }, actorId);
  } catch (error) {
    console.error(`[marketing] automatic invoice discount failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
