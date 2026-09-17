'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export interface MarketingNavItem {
  href: string;
  label: string;
  exact?: boolean;
}

export const MARKETING_NAV: readonly MarketingNavItem[] = [
  { href: '/admin/marketing', label: 'Overview', exact: true },
  { href: '/admin/marketing/contacts', label: 'Contacts' },
  { href: '/admin/marketing/campaigns', label: 'Campaigns' },
  { href: '/admin/marketing/ads', label: 'Ads' },
  { href: '/admin/marketing/social', label: 'Social' },
  { href: '/admin/marketing/reviews', label: 'Reviews' },
  { href: '/admin/marketing/growth', label: 'Growth' },
  { href: '/admin/marketing/pages', label: 'Pages' },
  { href: '/admin/marketing/content', label: 'Content' },
  { href: '/admin/marketing/settings', label: 'Settings' },
];

function isActive(pathname: string, item: MarketingNavItem): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Horizontal marketing sub-nav. Scrolls sideways on phones and keeps the active tab in view. */
export function MarketingNav({ demoChip }: { demoChip?: React.ReactNode }) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  return (
    <div className="sticky top-14 z-20 -mx-4 mb-6 border-b border-line bg-carbon/92 backdrop-blur-xl sm:-mx-6 lg:top-0 lg:mx-0 lg:mb-8 lg:rounded-md lg:border">
      <div className="flex items-center gap-2 pr-3 lg:pr-2">
        <nav aria-label="Marketing" className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex w-max items-center gap-1 px-3 py-2 lg:px-2">
            {MARKETING_NAV.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    ref={active ? activeRef : undefined}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`relative inline-flex h-9 items-center rounded-sm px-3 text-sm font-semibold transition-colors ${
                      active ? 'bg-clover/12 text-clover' : 'text-chalk/70 hover:bg-gunmetal hover:text-chalk'
                    }`}
                  >
                    {item.label}
                    {active && <span className="absolute inset-x-3 -bottom-2 h-0.5 rounded-full bg-clover" aria-hidden="true" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {demoChip}
      </div>
    </div>
  );
}

/** In-section tabs (e.g. Contacts: People · Pipeline · Segments). */
export function SectionTabs({ items, label, activeHref }: { items: readonly MarketingNavItem[]; label: string; /** Overrides the pathname match (for tabs rendered by a page). */ activeHref?: string }) {
  const current = usePathname();
  const pathname = activeHref ?? current;
  return (
    <nav aria-label={label} className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-6 border-b border-line">
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px inline-flex h-10 items-center border-b-2 text-sm font-bold uppercase tracking-widest transition-colors ${
                  active ? 'border-clover text-chalk' : 'border-transparent text-steel hover:text-chalk'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const OVERVIEW_TABS: readonly MarketingNavItem[] = [
  { href: '/admin/marketing', label: 'Overview', exact: true },
  { href: '/admin/marketing/reports', label: 'Reports' },
  { href: '/admin/marketing/calendar', label: 'Calendar' },
];

/** Overview · Reports · Calendar. Rendered by those pages, not by a layout. */
export function MarketingSectionTabs({ active }: { active?: string }) {
  return <SectionTabs items={OVERVIEW_TABS} label="Overview sections" activeHref={active} />;
}
