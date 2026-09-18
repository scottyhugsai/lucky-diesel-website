import type { SiteEvent } from './analytics';

/**
 * Which contact event a clicked link represents, and where on the site it was
 * clicked.
 *
 * Phone is the channel this business actually runs on, and until now none of it
 * was measured: `trackEvent` was called from one component, so every `tel:` and
 * `sms:` link elsewhere — the hero, the mobile bar, every product page — fired
 * nothing. Those links live in server components, so instrumenting them one by
 * one would mean turning each into a client component. A single delegated
 * listener reads them all instead, including any added later.
 *
 * `source` answers the question the raw count cannot: a call from a product
 * page and a call from the footer say different things about what is working.
 */
export function contactClick(
  href: string | null | undefined,
  sourceId: string | null,
  pathname: string,
): { event: SiteEvent; source: string } | null {
  const scheme = href?.trim().toLowerCase();
  const event: SiteEvent | null = scheme?.startsWith('tel:')
    ? 'call_click'
    : scheme?.startsWith('sms:')
      ? 'text_click'
      : null;
  if (!event) return null;
  return { event, source: sourceId || pathname };
}

/**
 * Ids that wrap the whole page and so say nothing about where a click happened.
 * Reporting "main" as the source of a call looks like data and isn't.
 */
const GENERIC_REGIONS = new Set(['main', 'root', '__next', 'app', 'body']);

/** The nearest ancestor id worth recording, given ids from nearest outward. */
export function pickRegion(ancestorIds: readonly string[]): string | null {
  return ancestorIds.find((id) => id && !GENERIC_REGIONS.has(id)) ?? null;
}
