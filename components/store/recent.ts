/**
 * The parts this visitor looked at, kept in a cookie so the store can show them
 * again. Handles only — no prices, no counts, nothing the shop would have to
 * stand behind.
 */

export const RECENT_COOKIE = 'ld_seen';
export const RECENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const MAX_RECENT = 6;

const HANDLE = /^[a-z0-9][a-z0-9-]{0,118}$/;

/** Untrusted cookie text to a list of product handles. */
export function parseRecent(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen: string[] = [];
  for (const entry of raw.split(',')) {
    const handle = entry.trim().toLowerCase();
    if (HANDLE.test(handle) && !seen.includes(handle)) seen.push(handle);
    if (seen.length >= MAX_RECENT) break;
  }
  return seen;
}

/** Newest first, capped, no duplicates. Returns a new list. */
export function withRecent(current: readonly string[], handle: string): string[] {
  if (!HANDLE.test(handle)) return [...current];
  return [handle, ...current.filter((entry) => entry !== handle)].slice(0, MAX_RECENT);
}

/**
 * The remembered handles, resolved against a catalogue the caller has already
 * filtered. Order comes from the cookie — most recently opened first — because
 * that is the only thing this strip is claiming to be. A handle the catalogue
 * no longer carries is dropped rather than rendered as a dead tile.
 */
export function recentProducts<P extends { handle: string }>(
  products: readonly P[],
  handles: readonly string[],
  { exclude, limit = MAX_RECENT }: { exclude?: string; limit?: number } = {},
): P[] {
  if (handles.length === 0) return [];
  const byHandle = new Map(products.map((product) => [product.handle, product]));
  const found: P[] = [];
  for (const handle of handles) {
    if (handle === exclude) continue;
    const product = byHandle.get(handle);
    if (product) found.push(product);
    if (found.length >= limit) break;
  }
  return found;
}
