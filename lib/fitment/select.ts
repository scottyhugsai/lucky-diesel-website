import { TRUCKS, type Make, type TruckEngine, type TruckGeneration, type TruckModel } from '@/lib/vehicles';
import type { PlatformId } from '@/lib/store/normalize';

/**
 * The fitment picker's logic: year → make → model → engine, each step narrowing
 * the next. Pure and server-renderable, so the tool works without JavaScript
 * and every combination is an addressable URL.
 */

export interface Fitment {
  year: number | null;
  make: Make | null;
  model: string | null;
  engine: string | null;
}

export const EMPTY_FITMENT: Fitment = { year: null, make: null, model: null, engine: null };

const CURRENT_YEAR = new Date().getFullYear();

function generationFor(truck: TruckModel, year: number): TruckGeneration | null {
  return truck.generations.find((generation) => year >= generation.yearFrom && year <= (generation.yearTo ?? CURRENT_YEAR + 1)) ?? null;
}

const EARLIEST = Math.min(...TRUCKS.flatMap((truck) => truck.generations.map((generation) => generation.yearFrom)));
const LATEST = Math.max(CURRENT_YEAR, ...TRUCKS.flatMap((truck) => truck.generations.map((generation) => generation.yearTo ?? CURRENT_YEAR)));

/** Newest first: most people are picking a recent truck. */
export const YEARS: readonly number[] = Array.from({ length: LATEST - EARLIEST + 1 }, (_unused, index) => LATEST - index);

export const MAKE_LABELS: Record<Make, string> = { ford: 'Ford', ram: 'Ram', chevrolet: 'Chevrolet', gmc: 'GMC' };

export function trucksFor(year: number): TruckModel[] {
  return TRUCKS.filter((truck) => generationFor(truck, year) !== null);
}

export function makesFor(year: number): { id: Make; label: string }[] {
  const makes = [...new Set(trucksFor(year).map((truck) => truck.make))].sort();
  return makes.map((id) => ({ id, label: MAKE_LABELS[id] }));
}

export function modelsFor(year: number, make: Make): TruckModel[] {
  return trucksFor(year).filter((truck) => truck.make === make);
}

export function enginesFor(year: number, make: Make, model: string): readonly TruckEngine[] {
  const truck = modelsFor(year, make).find((candidate) => candidate.id === model);
  if (!truck) return [];
  return generationFor(truck, year)?.engines ?? [];
}

export interface FitmentResult {
  truck: TruckModel;
  generation: TruckGeneration;
  engine: TruckEngine;
  /** One of the shop's three diesel platforms, or null for everything else. */
  platform: PlatformId | null;
  /** False when the shop does not work on this engine — say so rather than guess. */
  supported: boolean;
  /** Shopify generation collection handle, when the store has one. */
  generationCollection: string | null;
  /** "2022 Ford F-250 · 6.7L Power Stroke V8" */
  label: string;
}

/** A complete, self-consistent pick → everything the page needs to answer with. */
export function resolveFitment(fitment: Fitment): FitmentResult | null {
  const { year, make, model, engine } = fitment;
  if (year === null || make === null || model === null || engine === null) return null;

  const truck = modelsFor(year, make).find((candidate) => candidate.id === model);
  if (!truck) return null;
  const generation = generationFor(truck, year);
  if (!generation) return null;
  const found = generation.engines.find((candidate) => candidate.id === engine);
  if (!found) return null;

  return {
    truck,
    generation,
    engine: found,
    platform: found.platform,
    supported: found.platform !== null,
    generationCollection: found.platform ? generation.generationCollection : null,
    label: `${year} ${MAKE_LABELS[make]} ${truck.model} · ${found.name}`,
  };
}

const isMake = (value: unknown): value is Make => typeof value === 'string' && value in MAKE_LABELS;

/**
 * Untrusted query params → a selection where every step is consistent with the
 * one before it. A value that no longer narrows anything is dropped rather than
 * kept, so a stale link degrades to the nearest valid state instead of erroring.
 */
export function parseFitment(params: Record<string, string | string[] | undefined>): Fitment {
  const one = (key: string): string | null => {
    const value = params[key];
    const text = Array.isArray(value) ? value[0] : value;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  };

  const yearText = one('year');
  const year = yearText && /^\d{4}$/.test(yearText) && YEARS.includes(Number(yearText)) ? Number(yearText) : null;
  if (year === null) return EMPTY_FITMENT;

  const makeText = one('make');
  const make = isMake(makeText) && makesFor(year).some((candidate) => candidate.id === makeText) ? makeText : null;
  if (make === null) return { year, make: null, model: null, engine: null };

  const modelText = one('model');
  const model = modelText && modelsFor(year, make).some((candidate) => candidate.id === modelText) ? modelText : null;
  if (model === null) return { year, make, model: null, engine: null };

  const engineText = one('engine');
  const engine = engineText && enginesFor(year, make, model).some((candidate) => candidate.id === engineText) ? engineText : null;
  return { year, make, model, engine };
}

/** The selection as query params, for links that keep the truck. */
export function fitmentParams(fitment: Fitment): URLSearchParams {
  const params = new URLSearchParams();
  if (fitment.year) params.set('year', String(fitment.year));
  if (fitment.make) params.set('make', fitment.make);
  if (fitment.model) params.set('model', fitment.model);
  if (fitment.engine) params.set('engine', fitment.engine);
  return params;
}
