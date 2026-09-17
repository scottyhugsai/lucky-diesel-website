/** Telemetry navigation. Five tabs; everything else lives in the More sheet. */
export const TABS = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/book', label: 'Book', icon: 'book' },
  { href: '/store', label: 'Store', icon: 'store' },
  { href: '/build-planner', label: 'Plan', icon: 'plan' },
] as const;

export const MORE_LINKS = [
  { href: '/builds', label: 'Builds' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/#services', label: 'Services' },
  { href: '/duramax', label: 'Trucks' },
  { href: '/review', label: 'Reviews' },
  { href: '/emissions-policy', label: 'Emissions policy' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/login', label: 'Log in' },
] as const;

/** Which tab a pathname belongs to. `null` means it lives under More. */
export function activeTab(pathname: string): string | null {
  if (pathname === '/') return '/';
  const hit = TABS.find((tab) => tab.href !== '/' && pathname.startsWith(tab.href));
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
