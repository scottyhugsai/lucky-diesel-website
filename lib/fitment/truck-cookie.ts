import { PLATFORMS } from '@/lib/site';
import type { TruckSelection } from '@/lib/store/normalize';
import { EMPTY_FITMENT, fitmentParams, parseFitment, resolveFitment, type Fitment } from './select';

/**
 * The visitor's truck, kept in a cookie so it survives the walk from the
 * fitment picker to the store. A cookie rather than localStorage because the
 * listing has to arrive already filtered — rendered on the server, right on the
 * first paint and right with JavaScript switched off. Re-asking for the vehicle
 * on every surface is where shoppers give up.
 *
 * It holds a shopping preference and nothing about a person, so the client may
 * read it too: the store's interactive pickers keep it in step.
 */

export const TRUCK_COOKIE = 'ld_truck';
export const TRUCK_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
/** Room for a full pick plus the derived platform, and no room for junk. */
const MAX_COOKIE_LENGTH = 200;
/** Anything outside printable ASCII, plus the backslash: not a path this site issued. */
const UNSAFE_PATH = /[^!-~]|\\/;

export interface SavedTruck {
  /** The full year-to-engine pick when it came from the picker; empty when only a platform is known. */
  fitment: Fitment;
  /** What the store's filters and fitment badges actually run on. */
  selection: TruckSelection;
}

/** A complete pick of an engine the shop works on. Anything else is not a truck we can shop for. */
export function truckFromFitment(fitment: Fitment): SavedTruck | null {
  const result = resolveFitment(fitment);
  if (!result?.supported || result.platform === null) return null;
  return { fitment, selection: { platform: result.platform, generationCollection: result.generationCollection } };
}

/** The coarser pick the store's own controls offer: a platform, and maybe a generation. */
export function truckFromSelection(platform: unknown, generation: unknown): SavedTruck | null {
  const found = PLATFORMS.find((entry) => entry.id === platform);
  if (!found) return null;
  const collection = typeof generation === 'string' && found.generationCollections.includes(generation) ? generation : null;
  return { fitment: EMPTY_FITMENT, selection: { platform: found.id, generationCollection: collection } };
}

/** Both halves are written: if the vehicle data later moves on, the platform still resolves. */
export function encodeTruck(saved: SavedTruck): string {
  const params = fitmentParams(saved.fitment);
  params.set('platform', saved.selection.platform);
  if (saved.selection.generationCollection) params.set('gen', saved.selection.generationCollection);
  return params.toString();
}

/** Untrusted cookie text becomes a truck, or nothing. Every value is checked against the catalog. */
export function decodeTruck(raw: string | null | undefined): SavedTruck | null {
  if (!raw || raw.length > MAX_COOKIE_LENGTH) return null;
  const params = Object.fromEntries(new URLSearchParams(raw));
  return truckFromFitment(parseFitment(params)) ?? truckFromSelection(params.platform, params.gen);
}

/** Where a save or a clear returns the visitor to: this site only, never anywhere else. */
export function safeReturnPath(value: unknown, fallback = '/store/products'): string {
  if (typeof value !== 'string' || value.length > 512) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  // A backslash or a stray newline is how an internal-looking path stops being one.
  return UNSAFE_PATH.test(value) ? fallback : value;
}
