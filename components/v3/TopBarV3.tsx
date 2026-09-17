'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClock, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CartButton } from '@/components/store/CartButton';
import { MONO } from './ui';
import { MORE_LINKS, TABS, activeTab } from './nav';
import type { NextSlot } from './data';

interface TopBarV3Props {
  nextSlot: NextSlot | null;
}

/** 56px instrument bar. Desktop gets the five destinations inline; phones get logo + cart (tabs live at the bottom). */
export function TopBarV3({ nextSlot }: TopBarV3Props) {
  const pathname = usePathname();
  const active = activeTab(pathname);
  // Keyed to the pathname so any navigation closes the menu without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const isMoreOpen = openFor === pathname;
  const moreRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!isMoreOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setOpenFor(null);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpenFor(null);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isMoreOpen]);

  const bookHref = nextSlot ? `/book?date=${nextSlot.date}` : '/book';

  return (
    <header className="v3-bar fixed inset-x-0 top-0 z-50 border-b border-line">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Lucky Diesel home" className="flex shrink-0 items-center gap-2.5">
          <Image src="/images/logo-mark.png" alt="" width={698} height={505} priority className="h-7 w-auto" />
          <span className="v3-title text-[0.9375rem] font-semibold tracking-tight">Lucky Diesel</span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 justify-center lg:flex">
          <ul className="flex items-center gap-1 text-sm">
            {TABS.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active === tab.href ? 'page' : undefined}
                  className={`v3-navlink inline-flex h-9 items-center rounded-[6px] px-3 font-medium transition-colors ${active === tab.href ? 'text-clover' : 'text-chalk/75 hover:text-chalk'}`}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
            <li ref={moreRef} className="relative">
              <button
                type="button"
                aria-expanded={isMoreOpen}
                aria-controls="v3-more-menu"
                onClick={() => setOpenFor(isMoreOpen ? null : pathname)}
                className={`inline-flex h-9 items-center gap-1 rounded-[6px] px-3 font-medium transition-colors ${active === null && pathname !== '/' ? 'text-clover' : 'text-chalk/75 hover:text-chalk'}`}
              >
                More <ChevronDown className={`size-3.5 transition-transform ${isMoreOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              <ul
                id="v3-more-menu"
                hidden={!isMoreOpen}
                className="v3-menu absolute left-1/2 top-full mt-2 w-52 -translate-x-1/2 rounded-[8px] border border-line p-1.5"
              >
                {MORE_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="block rounded-[6px] px-3 py-2 text-sm text-chalk/85 hover:bg-chalk/8 hover:text-chalk">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <CartButton className="size-11 text-chalk" />
          <Link
            href={bookHref}
            className="inline-flex h-10 items-center gap-2 rounded-[6px] bg-clover px-3 text-sm font-semibold text-carbon transition-[filter] hover:brightness-110 sm:px-3.5"
          >
            <CalendarClock className="size-4" aria-hidden="true" />
            <span>Book</span>
            {nextSlot && (
              <span className={`${MONO} hidden items-center gap-2 text-[0.8125rem] font-medium sm:inline-flex`}>
                <span aria-hidden="true" className="opacity-50">·</span>
                <span><span className="sr-only">Next open slot </span>{nextSlot.label}</span>
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
