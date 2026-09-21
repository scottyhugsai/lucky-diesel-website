import { FORD_TRUCKS } from './ford';
import { GM_TRUCKS } from './gm';
import { RAM_TRUCKS } from './ram';
import type { TruckGeneration, TruckModel } from './types';

export type { Fuel, Make, TruckEngine, TruckGeneration, TruckModel } from './types';

/**
 * Full-size American pickups, 2001 model year onward, gas and diesel. Public
 * vehicle data only — nothing here is a claim about what the shop stocks.
 */
export const TRUCKS: readonly TruckModel[] = [...FORD_TRUCKS, ...RAM_TRUCKS, ...GM_TRUCKS];

export function findTruck(id: string): TruckModel | null {
  return TRUCKS.find((truck) => truck.id === id) ?? null;
}

export function findGeneration(truckId: string, generationId: string): TruckGeneration | null {
  return findTruck(truckId)?.generations.find((generation) => generation.id === generationId) ?? null;
}

const MAKE_NAME: Record<TruckModel['make'], string> = { ford: 'Ford', ram: 'Ram', chevrolet: 'Chevrolet', gmc: 'GMC' };

/** Ram trucks wore a Dodge badge until the 2011 model year. */
export function truckLabel(truck: TruckModel, generation?: TruckGeneration): string {
  const dodge = truck.make === 'ram' && generation !== undefined && (generation.yearTo ?? Infinity) < 2011;
  return `${dodge ? 'Dodge Ram' : MAKE_NAME[truck.make]} ${truck.model}`;
}

export interface GenerationFitment {
  truckId: string;
  /** Badge and model as it was sold, e.g. "Dodge Ram 2500" or "GMC Sierra 3500HD". */
  name: string;
  /** The designation people use, which can carry a half year. */
  label: string;
  yearFrom: number;
  yearTo: number | null;
  /** Engine names on that generation that belong to this collection. */
  engines: string[];
}

/**
 * Which trucks were sold with one engine generation.
 *
 * This is what makes a generation page worth having: the tiers and the services
 * on it are the same for all nineteen, but the trucks that carry the engine are
 * different every time, and they are public vehicle facts rather than a claim
 * about the shop. Ordered oldest first, then by name, so the list is stable.
 */
export function trucksForGeneration(collection: string): GenerationFitment[] {
  if (!collection) return [];
  const found = TRUCKS.flatMap((truck) =>
    truck.generations
      .filter((generation) => generation.generationCollection === collection)
      .map((generation) => ({
        truckId: truck.id,
        name: truckLabel(truck, generation),
        label: generation.label,
        yearFrom: generation.yearFrom,
        yearTo: generation.yearTo,
        engines: generation.engines.filter((engine) => engine.fuel === 'diesel' && engine.platform !== null).map((engine) => engine.name),
      })),
  );
  return found.sort((a, b) => a.yearFrom - b.yearFrom || a.name.localeCompare(b.name));
}
