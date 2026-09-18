'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Menu, Phone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CartButton } from '@/components/store/CartButton';
import { BUSINESS } from '@/lib/site';
import { resolveNav, type SiteNav } from '@/lib/site-nav';
import { WRAP } from './ui';

/** A hairline bar, 56px tall. No shadow, no blur — the rule does the work. */
export function SiteHeaderV4({ nav = resolveNav(null) }: { nav?: SiteNav }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setIsOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const close = () => setIsOpen(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-carbon/90 backdrop-blur">
        <div className={`${WRAP} flex h-14 items-center justify-between gap-6`}>
          <Link href="/" onClick={close} aria-label="Lucky Diesel home" className="flex items-center gap-2.5">
            <Image src="/images/logo-mark.png" alt="" width={698} height={505} priority className="h-6 w-auto" />
            <span className="v4-title text-[0.9375rem] tracking-[-0.02em]">Lucky Diesel</span>
          </Link>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-7 text-[0.9375rem] text-steel">
              {nav.primary.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="inline-block py-2 transition-colors hover:text-chalk">{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            <a href={BUSINESS.phoneHref} className="v4-num text-[0.9375rem] text-chalk transition-colors hover:text-clover">{BUSINESS.phoneDisplay}</a>
            <CartButton />
            <Link href="/book" className="inline-flex min-h-9 items-center rounded-full bg-chalk px-4 text-[0.875rem] font-semibold text-carbon transition-colors hover:bg-clover">Book</Link>
          </div>

          <div className="flex items-center gap-1 lg:hidden">
            <CartButton className="size-11" />
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls="v4-menu"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setIsOpen((open) => !open)}
              className="grid size-11 place-items-center rounded-full border border-line"
            >
              {isOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <div id="v4-menu" hidden={!isOpen} className="fixed inset-x-0 bottom-0 top-14 z-50 overflow-y-auto bg-carbon px-5 pb-12 pt-4 lg:hidden">
        <nav aria-label="Mobile">
          <ul>
            {nav.primary.map((item) => (
              <li key={item.href} className="v4-row">
                <Link href={item.href} onClick={close} className="v4-title block py-4 text-3xl">{item.label}</Link>
              </li>
            ))}
          </ul>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[0.9375rem] text-steel">
            {nav.more.map((item) => (
              <li key={item.href}><Link href={item.href} onClick={close} className="py-1 hover:text-chalk">{item.label}</Link></li>
            ))}
          </ul>
        </nav>
        <a href={BUSINESS.phoneHref} className="mt-8 flex min-h-12 items-center justify-center gap-2 rounded-full bg-chalk font-semibold text-carbon">
          <Phone className="size-4" aria-hidden="true" /> {BUSINESS.phoneDisplay}
        </a>
      </div>
    </>
  );
}
