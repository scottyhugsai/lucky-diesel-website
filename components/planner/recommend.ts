import { fitsTruck, type PlatformId, type StoreVariant } from '@/lib/store/normalize';
import { BUDGETS, type BudgetId, type GoalId } from './options';
import type { PlannerProduct } from './product';

/**
 * Build-planner rules. Pure: catalog + truck + goal + budget in, staged plan out.
 * Only parts that fit ('fits', else 'platform') are ever picked — never 'no'.
 */

export type SlotId = 'tune' | 'trans' | 'exhaust' | 'cp3' | 'injectors' | 'turbo';
export type StageId = 'tune' | 'breathe' | 'turbo';
export type Fit = 'fits' | 'platform';
export type Emissions = 'offroad' | 'compliant' | 'confirm';
type SizePref = 'small' | 'mid' | 'large' | 'any';

export interface PlanTruck { platform: PlatformId; generationCollection: string }
export interface PlanInput {
  products: readonly PlannerProduct[];
  truck: PlanTruck;
  goal: GoalId;
  budget: BudgetId | null;
  /** Shopper swaps: slot → variant id. Honoured when that variant is a valid candidate. */
  overrides?: Partial<Record<SlotId, number>>;
}
export interface PlanOption { productId: number; variantId: number; title: string; variantTitle: string | null; priceCents: number; fit: Fit }
export interface PlanPick {
  slot: SlotId; slotName: string; product: PlannerProduct; variant: StoreVariant; fit: Fit; emissions: Emissions;
  alternatives: PlanOption[]; swapped: boolean; confirmYear: boolean;
}
export interface PlanStage { id: StageId; name: string; picks: PlanPick[] }
export interface SkippedPick { slot: SlotId; slotName: string; title: string; variantTitle: string | null; priceCents: number }
export interface Plan {
  hasFitment: boolean; stages: PlanStage[]; subtotalCents: number; overBudgetCents: number;
  skipped: SkippedPick[]; notes: string[]; supporting: string[];
}

interface Candidate { product: PlannerProduct; variant: StoreVariant; fit: Fit; text: string }

export const SLOTS: Record<SlotId, { name: string; stage: StageId }> = {
  tune: { name: 'Engine tune', stage: 'tune' },
  trans: { name: 'Transmission tune', stage: 'tune' },
  exhaust: { name: 'Exhaust', stage: 'breathe' },
  cp3: { name: 'CP3 pump', stage: 'breathe' },
  injectors: { name: 'Injectors', stage: 'breathe' },
  turbo: { name: 'Turbo', stage: 'turbo' },
};
const STAGE_NAMES: Record<StageId, string> = { tune: 'Tune', breathe: 'Breathe & fuel', turbo: 'Turbo' };
const STAGE_ORDER: StageId[] = ['tune', 'breathe', 'turbo'];

/** Slot → size preference, in budget priority order (first gets the money first). */
const GOAL_RULES: Record<GoalId, [SlotId, SizePref][]> = {
  daily: [['tune', 'any'], ['exhaust', 'any'], ['cp3', 'any']],
  tow: [['tune', 'any'], ['trans', 'any'], ['exhaust', 'any'], ['cp3', 'small'], ['turbo', 'small']],
  power: [['tune', 'any'], ['exhaust', 'any'], ['turbo', 'mid'], ['cp3', 'mid']],
  allout: [['tune', 'any'], ['trans', 'any'], ['turbo', 'large'], ['injectors', 'large'], ['cp3', 'large'], ['exhaust', 'any']],
};
const SUPPORTING: Record<GoalId, string[]> = {
  daily: ['Lift pump', 'Fuel filters'],
  tow: ['Head studs', 'Lift pump', 'EGT & trans temp gauges'],
  power: ['Lift pump', 'Head studs'],
  allout: ['Head studs', 'Lift pump', 'Built transmission'],
};
const MAX_INJECTOR_OVER = 100;
const MAX_ALTERNATIVES = 16;

const PLATFORM_WORDS: Record<PlatformId, RegExp> = {
  duramax: /\b(duramax|lb7|lly|lbz|lmm|lml|l5p)\b/i,
  powerstroke: /\b(powerstroke|power stroke|psd)\b/i,
  cummins: /\bcummins\b/i,
};
const TRANS_TEXT = /transmission|tcm|10r140/i;
const hasTrans = (text: string) => TRANS_TEXT.test(text.replace(/no transmission( tuning)?/gi, ''));
const YEAR_RANGE = /\b(19|20)\d{2}\s*-\s*(\d{2,4}|present)\b/i;

const SLOT_MATCH: Record<SlotId, (p: PlannerProduct) => boolean> = {
  tune: (p) => p.category === 'tuning' && !/upgrade|autoagent/i.test(p.title) && !(TRANS_TEXT.test(p.title) && !/engine/i.test(p.title)),
  trans: (p) => p.category === 'tuning' && TRANS_TEXT.test(p.title) && !/engine|upgrade/i.test(p.title),
  exhaust: (p) => p.category === 'exhaust',
  cp3: (p) => p.category === 'fuel' && /cp3/i.test(p.title),
  injectors: (p) => p.category === 'fuel' && /injector/i.test(p.title),
  turbo: (p) => p.category === 'turbo',
};

export function emissionsOf(product: Pick<PlannerProduct, 'offRoadOnly' | 'title'>, variant: Pick<StoreVariant, 'title'>): Emissions {
  if (product.offRoadOnly) return 'offroad';
  return /emissions[- ]compliant|carb\b|\be\.?o\.? ?#/i.test(`${product.title} ${variant.title ?? ''}`) ? 'compliant' : 'confirm';
}

/** "66mm" → 66, "45% Over" → 45; null when the part has no size. */
export function sizeOf(text: string): number | null {
  const match = text.match(/(\d{2,3})\s?(mm|% over)/i);
  return match ? Number(match[1]) : null;
}

function namesOtherPlatform(title: string, platform: PlatformId): boolean {
  if (PLATFORM_WORDS[platform].test(title)) return false;
  return (Object.keys(PLATFORM_WORDS) as PlatformId[]).some((other) => other !== platform && PLATFORM_WORDS[other].test(title));
}

/** A "5.9L Cummins" option on a shared product must not be picked for a 6.7L truck. */
function variantMatchesEngine(variant: StoreVariant, truck: PlanTruck): boolean {
  const engine = (variant.title ?? '').match(/(\d)\.(\d)\s?L\b/i);
  return !engine || truck.generationCollection.includes(`${engine[1]}-${engine[2]}l`);
}

function candidatesFor(slot: SlotId, input: PlanInput): Candidate[] {
  const { products, truck, goal } = input;
  const all = products.flatMap((product): Candidate[] => {
    if (!SLOT_MATCH[slot](product) || namesOtherPlatform(product.title, truck.platform)) return [];
    const fit = fitsTruck(product, truck);
    if (fit !== 'fits' && fit !== 'platform') return [];
    if (goal === 'daily' && product.offRoadOnly) return [];
    return product.variants
      .filter((v) => v.available && !/already linked|without pump/i.test(v.title ?? '') && variantMatchesEngine(v, truck))
      .map((variant) => ({ product, variant, fit, text: `${product.title} ${variant.title ?? ''}` }));
  });
  let pool = all.some((c) => c.fit === 'fits') ? all.filter((c) => c.fit === 'fits') : all;
  if (goal !== 'allout' && pool.some((c) => !c.product.offRoadOnly)) pool = pool.filter((c) => !c.product.offRoadOnly);
  if (slot === 'cp3' && pool.some((c) => /conversion kit/i.test(c.product.title))) pool = pool.filter((c) => /conversion kit/i.test(c.product.title));
  if (slot === 'cp3' && goal === 'daily') pool = pool.filter((c) => /reman|emissions[- ]compliant/i.test(c.text));
  if (slot === 'injectors') pool = pool.filter((c) => (sizeOf(c.text) ?? 0) <= MAX_INJECTOR_OVER);
  return pool;
}

function variantScore(slot: SlotId, goal: GoalId, c: Candidate): number {
  if (slot !== 'tune') return 0;
  let score = 0;
  if ((goal === 'tow' || goal === 'allout') && hasTrans(c.text)) score += 2;
  if (goal === 'allout' && /full/i.test(c.variant.title ?? '')) score += 1;
  return score;
}

function choose(pool: readonly Candidate[], slot: SlotId, goal: GoalId, pref: SizePref): Candidate | null {
  if (!pool.length) return null;
  let options = [...pool];
  const sized = options.filter((c) => sizeOf(c.text) !== null);
  if (pref !== 'any' && sized.length) {
    const sizes = [...new Set(sized.map((c) => sizeOf(c.text) as number))].sort((a, b) => a - b);
    const target = pref === 'small' ? sizes[0] : pref === 'large' ? sizes[sizes.length - 1] : sizes[Math.floor(sizes.length / 2)];
    options = sized.filter((c) => sizeOf(c.text) === target);
  }
  options.sort((a, b) => variantScore(slot, goal, b) - variantScore(slot, goal, a) || a.variant.priceCents - b.variant.priceCents);
  return options[0] ?? null;
}

function toPick(slot: SlotId, c: Candidate, pool: readonly Candidate[], swapped: boolean): PlanPick {
  const alternatives = pool
    .filter((o) => o.variant.id !== c.variant.id)
    .sort((a, b) => a.variant.priceCents - b.variant.priceCents)
    .slice(0, MAX_ALTERNATIVES)
    .map((o) => ({ productId: o.product.id, variantId: o.variant.id, title: o.product.title, variantTitle: o.variant.title, priceCents: o.variant.priceCents, fit: o.fit }));
  const yearSpecific = new Set(pool.filter((o) => YEAR_RANGE.test(o.product.title)).map((o) => o.product.id));
  return {
    slot, slotName: SLOTS[slot].name, product: c.product, variant: c.variant, fit: c.fit,
    emissions: emissionsOf(c.product, c.variant), alternatives, swapped, confirmYear: yearSpecific.size > 1,
  };
}

export function hasFitment(products: readonly PlannerProduct[], truck: PlanTruck): boolean {
  return products.some((p) => (Object.keys(SLOT_MATCH) as SlotId[]).some((s) => SLOT_MATCH[s](p))
    && !namesOtherPlatform(p.title, truck.platform) && fitsTruck(p, truck) === 'fits');
}

export function recommend(input: PlanInput): Plan {
  const { goal } = input;
  const supporting = [...SUPPORTING[goal]];
  if (!hasFitment(input.products, input.truck)) {
    return { hasFitment: false, stages: [], subtotalCents: 0, overBudgetCents: 0, skipped: [], notes: [], supporting };
  }
  const cap = BUDGETS.find((b) => b.id === input.budget)?.capCents ?? null;
  const rules = GOAL_RULES[goal];
  const pools = new Map(rules.map(([slot]) => [slot, candidatesFor(slot, input)] as const));
  const picks: PlanPick[] = [];
  const skipped: SkippedPick[] = [];
  const notes: string[] = [];

  // Shopper swaps claim their share of the budget first.
  for (const [slot] of rules) {
    const chosen = (pools.get(slot) ?? []).find((c) => c.variant.id === input.overrides?.[slot]);
    if (chosen) picks.push(toPick(slot, chosen, pools.get(slot) ?? [], true));
  }
  let spent = picks.reduce((sum, p) => sum + p.variant.priceCents, 0);

  for (const [slot, pref] of rules) {
    const pool = pools.get(slot) ?? [];
    if (picks.some((p) => p.slot === slot)) continue;
    if (slot === 'trans' && picks.some((p) => p.slot === 'tune' && hasTrans(`${p.product.title} ${p.variant.title ?? ''}`))) continue;
    const best = choose(pool, slot, goal, pref);
    if (!best) {
      if (slot === 'tune') notes.push('No street tune listed for this truck yet. Ask the shop.');
      if (slot === 'trans') supporting.unshift('Transmission tuning');
      continue;
    }
    const remaining = cap === null ? Infinity : cap - spent;
    const affordable = best.variant.priceCents <= remaining ? best
      : [...pool].filter((c) => c.variant.priceCents <= remaining).sort((a, b) => a.variant.priceCents - b.variant.priceCents)[0];
    if (!affordable) {
      skipped.push({ slot, slotName: SLOTS[slot].name, title: best.product.title, variantTitle: best.variant.title, priceCents: best.variant.priceCents });
      continue;
    }
    picks.push(toPick(slot, affordable, pool, false));
    spent += affordable.variant.priceCents;
  }

  const slotOrder = Object.keys(SLOTS) as SlotId[];
  const stages = STAGE_ORDER.map((id) => ({
    id, name: STAGE_NAMES[id],
    picks: picks.filter((p) => SLOTS[p.slot].stage === id).sort((a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot)),
  })).filter((stage) => stage.picks.length > 0);

  return {
    hasFitment: true, stages, subtotalCents: spent,
    overBudgetCents: cap === null ? 0 : Math.max(0, spent - cap),
    skipped, notes, supporting,
  };
}
