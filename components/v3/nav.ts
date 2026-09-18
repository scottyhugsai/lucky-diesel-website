import { resolveNav, type NavLink, type SiteNav } from '@/lib/site-nav';

export type TabIcon = 'home' | 'book' | 'store' | 'plan' | 'builds' | 'gallery' | 'services' | 'other';

export interface Tab extends NavLink {
  icon: TabIcon;
}

const ICON_BY_HREF: Record<string, TabIcon> = {
  '/': 'home',
  '/book': 'book',
  '/store': 'store',
  '/build-planner': 'plan',
  '/builds': 'builds',
  '/gallery': 'gallery',
  '/#services': 'services',
};

/** Telemetry navigation: Home plus the owner's first three, then More. */
export function tabsFor(nav: SiteNav = resolveNav(null)): Tab[] {
  const rest = nav.primary.slice(0, 3).map((link) => ({ ...link, icon: ICON_BY_HREF[link.href] ?? 'other' }));
  return [{ href: '/', label: 'Home', icon: 'home' }, ...rest];
}

const EXTRA_MORE: readonly NavLink[] = [
  { href: '/duramax', label: 'Trucks' },
  { href: '/review', label: 'Reviews' },
];

/** Everything the phone tab bar could not fit. */
export function moreFor(nav: SiteNav = resolveNav(null)): NavLink[] {
  const shown = new Set(tabsFor(nav).map((tab) => tab.href));
  return [...nav.primary.filter((link) => !shown.has(link.href)), ...EXTRA_MORE, ...nav.more];
}

/** Desktop shows every primary destination inline, so its More menu holds only the rest. */
export function desktopMoreFor(nav: SiteNav = resolveNav(null)): NavLink[] {
  return [...EXTRA_MORE, ...nav.more];
}

/** Which destination a pathname belongs to. `null` means it lives under More. */
export function activeTab(pathname: string, links: readonly NavLink[] = tabsFor()): string | null {
  if (pathname === '/') return '/';
  const hit = links.find((link) => link.href !== '/' && link.href.startsWith('/') && !link.href.includes('#') && pathname.startsWith(link.href));
  return hit?.href ?? null;
}

export const RECENT_KEY = 'ld_recent_v3';
export const RECENT_LIMIT = 6;

export interface RecentProduct {
  handle: string;
  title: string;
  price: string | null;
  image: string | null;
}

export function parseRecent(value: unknown): RecentProduct[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const v = item as Record<string, unknown>;
    if (typeof v.handle !== 'string' || typeof v.title !== 'string') return [];
    // Only absolute https (Shopify CDN) or same-origin /images paths are safe for next/image.
    const image = typeof v.image === 'string' && /^(https:\/\/|\/images\/)/.test(v.image) ? v.image : null;
    return [{ handle: v.handle, title: v.title, price: typeof v.price === 'string' ? v.price : null, image }];
  });
}
