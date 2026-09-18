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
