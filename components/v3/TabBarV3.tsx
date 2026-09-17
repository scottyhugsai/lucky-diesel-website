'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClock, Home, LayoutGrid, Route, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { MoreSheet } from './MoreSheet';
import { TABS, activeTab } from './nav';

const ICONS = { home: Home, book: CalendarClock, store: ShoppingBag, plan: Route } as const;

/** Phone tab bar: four destinations plus More. Sits in the safe area; the page pads itself clear of it. */
export function TabBarV3() {
  const pathname = usePathname();
  const active = activeTab(pathname);
  // Keyed to the pathname so any navigation closes the sheet without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const isMoreOpen = openFor === pathname;

  const moreIsActive = isMoreOpen || (active === null && pathname !== '/');

  return (
    <>
      <nav aria-label="Primary" className="v3-bar v3-tabbar fixed inset-x-0 bottom-0 z-50 border-t border-line lg:hidden">
        <ul className="grid grid-cols-5">
          {TABS.map((tab) => {
            const Icon = ICONS[tab.icon];
            const isActive = active === tab.href && !isMoreOpen;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`v3-tab flex h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium ${isActive ? 'text-clover' : 'text-chalk/65'}`}
                >
                  <Icon className="size-[22px]" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
                  {tab.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-expanded={isMoreOpen}
              aria-controls="v3-more-sheet"
              onClick={() => setOpenFor(isMoreOpen ? null : pathname)}
              className={`v3-tab flex h-14 w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium ${moreIsActive ? 'text-clover' : 'text-chalk/65'}`}
            >
              <LayoutGrid className="size-[22px]" strokeWidth={moreIsActive ? 2.25 : 1.75} aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet isOpen={isMoreOpen} onClose={() => setOpenFor(null)} />
    </>
  );
}
