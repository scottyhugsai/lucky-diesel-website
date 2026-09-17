'use server';

import { revalidatePath } from 'next/cache';
import { checkbox, dollarsToCents, guard, InputError, number, oneOf, requiredText, requiredUuid, shopDateTime, text, uuid, type ActionState } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { contestCopyIssues } from '@/lib/marketing/community/contest-rules';
import { generateOfferCodes } from '@/lib/marketing/core/loyalty';
import { lintOffer, MAX_PROGRAM_PERCENT } from '@/lib/marketing/core/promotions';
import { checkContent } from '@/lib/marketing/content/compliance';
import { createAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/marketing/growth';
const MAX_CODES_PER_BATCH = 500;

/** Shared copy rules (emissions, claims, review incentives, financing) plus offer-specific and contest rules. */
function reviewCopy(fields: (string | null)[], lint: ReturnType<typeof lintOffer>): { block: string | null; warn: string | null } {
  const shared = checkContent(fields);
  // Giveaway copy must carry the no-purchase line, link rules, and never require a share or tag.
  const contest = contestCopyIssues(fields.filter(Boolean).join(' \n'));
  const blocks = [...contest, ...shared.issues.filter((i) => i.severity === 'block').map((i) => `${i.term}: ${i.reason}`), ...lint.filter((i) => i.severity === 'block').map((i) => i.message)];
  const warns = [...shared.issues.filter((i) => i.severity === 'warn').map((i) => i.term), ...lint.filter((i) => i.severity === 'warn').map((i) => i.message)];
  return { block: blocks.length ? blocks.join(' ') : null, warn: warns.length ? warns.join(' · ') : null };
}

function bundleItems(form: FormData): string[] {
  const raw = text(form, 'bundle_items', { max: 600, label: 'Bundle items' }) ?? '';
  const items = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  if (items.length > 12 || items.some((i) => i.length > 80)) throw new InputError('Bundle: up to 12 items, 80 characters each.');
  return items;
}

export async function createOffer(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const code = requiredText(form, 'code', 'Code', 32).toUpperCase().replace(/\s+/g, '-');
    if (!/^[A-Z0-9-]{3,32}$/.test(code)) return { error: 'Code: 3–32 letters, numbers or dashes.' };
    const name = requiredText(form, 'name', 'Name', 120);
    const type = oneOf(form, 'kind', ['percent', 'amount', 'free_service', 'bundle', 'gift'] as const, 'type');
    const terms = text(form, 'terms', { max: 500, label: 'Terms' });
    const description = text(form, 'description', { max: 300, label: 'Description' });
    const endsAt = shopDateTime(form, 'ends_at', 'Expiry');
    if (endsAt && new Date(endsAt) < new Date()) return { error: 'Expiry is in the past.' };
    const maxRedemptions = number(form, 'max_redemptions', { min: 1, max: 100_000, integer: true, label: 'Total limit' });
    const perCustomer = number(form, 'per_customer_limit', { min: 1, max: 100, integer: true, label: 'Per customer' }) ?? 1;
    const minSpend = dollarsToCents(form, 'min_spend', { label: 'Minimum spend' }) ?? 0;
    const segmentId = uuid(form, 'segment_id', { required: false, label: 'Segment' });
    const creatorName = text(form, 'creator_name', { max: 60, label: 'Creator' });
    const commission = number(form, 'creator_commission_percent', { min: 0, max: 50, integer: true, label: 'Commission' }) ?? 0;
    const singleUse = checkbox(form, 'single_use');
    const isPublic = checkbox(form, 'public');
    if (isPublic && (segmentId || singleUse)) return { error: 'Public offers can’t be segment-only or single-use.' };

    let kind: 'percent' | 'amount' | 'free_service' = 'amount';
    let value = 0;
    let items: string[] = [];
    let bundlePrice: number | null = null;
    let giftItem: string | null = null;
    if (type === 'percent') {
      kind = 'percent';
      value = number(form, 'value', { min: 1, max: 100, integer: true, required: true, label: 'Percent' }) as number;
    } else if (type === 'bundle') {
      items = bundleItems(form);
      const separate = dollarsToCents(form, 'value', { required: true, label: 'Separate price', max: 50_000 }) as number;
      bundlePrice = dollarsToCents(form, 'bundle_price', { required: true, label: 'Bundle price', max: 50_000 }) as number;
      value = Math.max(0, separate - bundlePrice);
    } else if (type === 'gift') {
      kind = 'free_service';
      giftItem = requiredText(form, 'gift_item', 'Gift', 80);
      if (minSpend <= 0) return { error: 'Gift with purchase needs a minimum spend.' };
    } else {
      kind = type;
      value = dollarsToCents(form, 'value', { required: true, label: 'Value', max: 10_000 }) as number;
    }

    const lint = lintOffer({ kind, value, name, description, terms, endsAt, minSpendCents: minSpend, maxRedemptions, bundleItems: type === 'bundle' ? (items.length ? items : ['']) : [], bundlePriceCents: bundlePrice, giftItem, creatorName });
    const check = reviewCopy([name, description, terms, giftItem, ...items], lint);
    if (check.block) return { error: `Blocked. ${check.block}` };
    if (check.warn && !checkbox(form, 'ack')) return { error: `Check, then tick “Copy checked”: ${check.warn}` };

    const { error } = await createAdminClient().from('offers').insert({
      code, name, kind, value, terms, description, ends_at: endsAt, starts_at: new Date().toISOString(), max_redemptions: maxRedemptions,
      per_customer_limit: perCustomer, min_spend_cents: minSpend, segment_id: segmentId, single_use: singleUse, public: isPublic,
      bundle_items: items, bundle_price_cents: bundlePrice, gift_item: giftItem, creator_name: creatorName, creator_commission_percent: creatorName ? commission : 0,
    });
    if (error) return { error: error.code === '23505' ? 'That code is taken.' : 'Couldn’t save the offer.' };
    revalidatePath(PATH);
    revalidatePath('/offers');
    return { notice: `${code} is live.` };
  });
}

export async function setOfferActive(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'offer_id', 'Offer');
    const active = checkbox(form, 'active');
    const { error } = await createAdminClient().from('offers').update({ active }).eq('id', id);
    if (error) return { error: 'Couldn’t update the offer.' };
    revalidatePath(PATH);
    revalidatePath('/offers');
    return { notice: active ? 'Offer on.' : 'Offer paused.' };
  });
}

/** Unassigned single-use codes for print, counter or partner handouts. */
export async function createOfferCodes(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const offerId = requiredUuid(form, 'offer_id', 'Offer');
    const count = number(form, 'count', { min: 1, max: MAX_CODES_PER_BATCH, integer: true, required: true, label: 'How many' }) as number;
    const result = await generateOfferCodes(offerId, count);
    if (!result.ok) return { error: `Couldn’t make codes. ${result.error}` };
    revalidatePath(PATH);
    return { notice: `${result.codes.length} codes ready.` };
  });
}

/** Military / first responder percent and fleet volume tiers (labor discounts). */
export async function savePricingPrograms(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const military = number(form, 'military_labor_percent', { min: 0, max: MAX_PROGRAM_PERCENT, integer: true, required: true, label: 'Military %' }) as number;
    const tiers: { min_trucks: number; labor_percent: number }[] = [];
    for (const i of [0, 1, 2]) {
      const min = number(form, `fleet_min_${i}`, { min: 1, max: 1000, integer: true, label: 'Trucks' });
      const pct = number(form, `fleet_pct_${i}`, { min: 0, max: MAX_PROGRAM_PERCENT, integer: true, label: 'Fleet %' });
      if (min !== null && pct !== null) tiers.push({ min_trucks: min, labor_percent: pct });
    }
    if (new Set(tiers.map((t) => t.min_trucks)).size !== tiers.length) return { error: 'Each fleet tier needs a different truck count.' };
    const { error } = await createAdminClient().from('marketing_settings').upsert({ id: 1, military_labor_percent: military, fleet_volume_tiers: tiers.sort((a, b) => a.min_trucks - b.min_trucks) }, { onConflict: 'id' });
    if (error) return { error: 'Couldn’t save pricing.' };
    revalidatePath(PATH);
    return { notice: 'Pricing saved.' };
  });
}
