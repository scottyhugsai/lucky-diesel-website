import { PLATFORMS, type Platform } from '@/lib/site';
import { isBudget, isGoal, isStep, STEPS, type BudgetId, type GoalId, type StepId } from './options';
import { SLOTS, type SlotId } from './recommend';

/** The whole plan lives in the URL so it can be shared and survives a refresh. */
export interface PlannerState {
  platform: Platform['id'] | null;
  gen: string | null;
  miles: string;
  goal: GoalId | null;
  budget: BudgetId | null;
  picks: Partial<Record<SlotId, number>>;
  step: StepId;
}

type ParamSource = Record<string, string | string[] | undefined> | URLSearchParams;

const MAX_MILES_LENGTH = 7;

function read(source: ParamSource, key: string): string | null {
  if (source instanceof URLSearchParams) return source.get(key);
  const value = source[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function parsePicks(raw: string | null): Partial<Record<SlotId, number>> {
  if (!raw) return {};
  const entries = raw.split(',').flatMap((pair): [SlotId, number][] => {
    const [slot, id] = pair.split('.');
    const variantId = Number(id);
    return slot && slot in SLOTS && Number.isSafeInteger(variantId) && variantId > 0 ? [[slot as SlotId, variantId]] : [];
  });
  return Object.fromEntries(entries);
}

/** The first step still missing an answer; you can't land past it. */
function earliestOpenStep(state: Omit<PlannerState, 'step'>): StepId {
  if (!state.platform) return 'platform';
  if (!state.gen) return 'generation';
  if (!state.goal) return 'goal';
  return 'plan';
}

export function parsePlannerState(source: ParamSource): PlannerState {
  const platformId = read(source, 'platform');
  const platform = PLATFORMS.find((p) => p.id === platformId) ?? null;
  const genRaw = read(source, 'gen');
  const gen = platform && genRaw && platform.generationCollections.includes(genRaw) ? genRaw : null;
  const goalRaw = read(source, 'goal');
  const budgetRaw = read(source, 'budget');
  const base = {
    platform: platform?.id ?? null,
    gen,
    miles: (read(source, 'miles') ?? '').replace(/\D/g, '').slice(0, MAX_MILES_LENGTH),
    goal: isGoal(goalRaw) ? goalRaw : null,
    budget: isBudget(budgetRaw) ? budgetRaw : null,
    picks: parsePicks(read(source, 'picks')),
  };
  const requested = read(source, 'step');
  const open = earliestOpenStep(base);
  const index = (id: StepId) => STEPS.findIndex((s) => s.id === id);
  const wanted: StepId = isStep(requested) ? requested : open === 'plan' ? 'plan' : open;
  return { ...base, step: index(wanted) > index(open) ? open : wanted };
}

export function plannerQuery(state: PlannerState): string {
  const params = new URLSearchParams();
  if (state.platform) params.set('platform', state.platform);
  if (state.gen) params.set('gen', state.gen);
  if (state.miles) params.set('miles', state.miles);
  if (state.goal) params.set('goal', state.goal);
  if (state.budget) params.set('budget', state.budget);
  const picks = Object.entries(state.picks).map(([slot, id]) => `${slot}.${id}`).join(',');
  if (picks) params.set('picks', picks);
  params.set('step', state.step);
  return `?${params.toString()}`;
}

export function generationLabel(platformId: Platform['id'] | null, gen: string | null): string {
  const platform = PLATFORMS.find((p) => p.id === platformId);
  if (!platform) return '';
  const index = gen ? platform.generationCollections.indexOf(gen) : -1;
  return index >= 0 ? (platform.generations[index] ?? '') : '';
}

export function truckLabel(state: Pick<PlannerState, 'platform' | 'gen'>): string {
  const platform = PLATFORMS.find((p) => p.id === state.platform);
  if (!platform) return 'Your truck';
  const generation = generationLabel(state.platform, state.gen);
  return generation ? `${platform.name} ${generation}` : platform.name;
}
