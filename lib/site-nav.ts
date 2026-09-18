import type { BlockValues } from '@/lib/site-content/fields';
import { DEFAULT_NAV, NAV_DESTINATIONS } from '@/lib/site-content/registry/nav';

export interface NavLink {
  href: string;
  label: string;
}

/** Pages that are always reachable from the More menu, whatever the owner picks. */
const ALWAYS_IN_MORE: readonly NavLink[] = [
  { href: '/emissions-policy', label: 'Emissions policy' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/login', label: 'Log in' },
];

export interface SiteNav {
  /** At most five. Anything else moves to `more`. */
  primary: NavLink[];
  more: NavLink[];
}

/**
 * Resolves the navigation from the owner's settings, falling back to what the
 * site ships with. Pure, so client components can take the result as a prop.
 */
export function resolveNav(values?: BlockValues | null): SiteNav {
  const stored = Array.isArray(values?.items) ? (values.items as string[]) : null;
  const chosen = (stored?.length ? stored : DEFAULT_NAV).filter((id) => NAV_DESTINATIONS.some((d) => d.value === id)).slice(0, 5);

  const label = (id: string, fallback: string): string => {
    const custom = values?.[`label.${id}`];
    return typeof custom === 'string' && custom.trim() ? custom.trim() : fallback;
  };
  const linkFor = (id: string): NavLink | null => {
    const destination = NAV_DESTINATIONS.find((d) => d.value === id);
    return destination ? { href: destination.href, label: label(id, destination.label) } : null;
  };

  const primary = chosen.map(linkFor).filter((link): link is NavLink => link !== null);
  const more = NAV_DESTINATIONS.filter((d) => !chosen.includes(d.value)).map((d) => ({ href: d.href, label: label(d.value, d.label) }));
  return { primary, more: [...more, ...ALWAYS_IN_MORE] };
}

/** The shipped navigation, for components rendered without content (tests, fallbacks). */
export const PRIMARY_NAV: readonly NavLink[] = resolveNav(null).primary;
