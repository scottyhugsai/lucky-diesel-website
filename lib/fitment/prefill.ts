import { PLATFORMS } from '@/lib/site';
import type { SavedTruck } from './truck-cookie';

/**
 * The saved truck, expressed in the two fields the booking and quote forms ask
 * for.
 *
 * The picker asks year → make → model → engine and remembers the answer. Both
 * forms then asked again, in a different vocabulary — a platform radio and a
 * generation select — so a visitor who had just told the site they drive a 2016
 * Ram 2500 6.7L had to re-derive that into "Cummins / 2013–2018 6.7L", at the
 * moment they are deciding whether this shop is organised enough to trust with
 * several thousand dollars. This carries the answer across.
 *
 * `generationCollections` and `generations` are parallel arrays — the Shopify
 * collection handle and the label a person reads — so the handle the cookie
 * stores is matched to its label by position. A handle belonging to a different
 * platform yields no generation rather than a wrong one.
 */
export function truckPrefill(saved: SavedTruck | null): { platform: string; generation: string } {
  const platform = PLATFORMS.find((entry) => entry.id === saved?.selection.platform);
  if (!platform) return { platform: '', generation: '' };
  const index = platform.generationCollections.indexOf(saved?.selection.generationCollection ?? '');
  return { platform: platform.id, generation: index === -1 ? '' : platform.generations[index] };
}
