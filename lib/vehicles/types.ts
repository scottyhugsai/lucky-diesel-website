import type { PlatformId } from '../store/normalize';

export type Fuel = 'diesel' | 'gas';
export type Make = 'ford' | 'ram' | 'chevrolet' | 'gmc';

export interface TruckEngine {
  id: string;
  /** As the manufacturer sold it. A parenthetical narrows an engine offered for only part of a generation. */
  name: string;
  fuel: Fuel;
  /** One of the shop's three diesel platforms, or null for everything else — including light-duty diesels it does not cover. */
  platform: PlatformId | null;
}

export interface TruckGeneration {
  id: string;
  /** The designation people use, which can carry a half year: '2004.5–2005'. */
  label: string;
  /**
   * Whole model years, used for ordering and overlap checks. A mid-year engine
   * change rounds to the first full model year it covers, so the bounds stay
   * disjoint while `label` keeps the real changeover.
   */
  yearFrom: number;
  yearTo: number | null;
  engines: readonly TruckEngine[];
  /** Matching Shopify generation collection handle, or null where the shop has none. */
  generationCollection: string | null;
}

export interface TruckModel {
  id: string;
  make: Make;
  model: string;
  /** '1500' | '2500' | '3500' | '4500' — the weight class, not the badge. */
  class: string;
  generations: readonly TruckGeneration[];
}

export const dieselEngine = (id: string, name: string, platform: PlatformId | null): TruckEngine => ({ id, name, fuel: 'diesel', platform });
export const gasEngine = (id: string, name: string): TruckEngine => ({ id, name, fuel: 'gas', platform: null });
