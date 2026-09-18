'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Menu, MessageSquare, Phone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CartButton } from '@/components/store/CartButton';
import { BUSINESS } from '@/lib/site';
import { resolveNav, type SiteNav } from '@/lib/site-nav';

/** Thin translucent Apple-style bar. 48px tall; the page sits underneath it. */
export function SiteHeaderV2({ nav = resolveNav(null) }: { nav?: SiteNav }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    if (!isMenuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setIsMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
    <header className="v2-bar fixed inset-x-0 top-0 z-50 border-b border-chalk/10">
      <div className="mx-auto flex h-12 max-w-[1024px] items-center justify-between px-4 sm:px-6">
        <Link href="/" onClick={closeMenu} aria-label="Lucky Diesel home" className="flex items-center gap-2">
          <Image src="/images/logo-mark.png" alt="" width={698} height={505} priority className="h-[22px] w-auto" />
          <span className="text-[13px] font-semibold tracking-tight text-chalk lg:sr-only">Lucky Diesel</span>
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-8 text-[12px] font-normal text-chalk/80">
            {nav.primary.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-colors hover:text-chalk">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <Link href="/login" className="text-[12px] text-chalk/80 transition-colors hover:text-chalk">
            Log in
          </Link>
          <CartButton className="size-9 text-chalk/80" />
          <Link href="/book" className="inline-flex h-7 items-center rounded-full bg-clover px-3.5 text-[12px] font-medium text-carbon transition-[filter] hover:brightness-110">
            Book
          </Link>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <CartButton className="size-11 text-chalk" />
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full text-chalk"
            aria-expanded={isMenuOpen}
            aria-controls="v2-menu"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>

      {/* Sibling of the header: backdrop-filter on the bar would otherwise become this fixed sheet's containing block. */}
      <div
        id="v2-menu"
        hidden={!isMenuOpen}
        className="v2-sheet fixed inset-x-0 bottom-0 top-12 z-50 overflow-y-auto px-6 pb-12 pt-6 lg:hidden"
      >
        <nav aria-label="Mobile">
          <ul className="divide-y divide-chalk/10">
            {nav.primary.map((item, index) => (
              <li key={item.href} className="rise" style={{ '--rise-delay': `${index * 45}ms` } as React.CSSProperties}>
                <Link href={item.href} onClick={closeMenu} className="block py-3.5 text-[28px] font-semibold tracking-tight text-chalk active:text-clover">
                  {item.label}
                </Link>
              </li>
            ))}
            {nav.more.map((item, index) => (
              <li key={item.href} className="rise" style={{ '--rise-delay': `${(nav.primary.length + index) * 45}ms` } as React.CSSProperties}>
                <Link href={item.href} onClick={closeMenu} className="block py-3 text-[17px] font-medium tracking-tight text-chalk/60 active:text-clover">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="rise mt-8 grid grid-cols-2 gap-3" style={{ '--rise-delay': '340ms' } as React.CSSProperties}>
          <a href={BUSINESS.phoneHref} className="flex h-12 items-center justify-center gap-2 rounded-full bg-chalk/10 text-[15px] font-medium text-chalk">
            <Phone className="size-4" aria-hidden="true" /> Call
          </a>
          <a href={BUSINESS.smsHref} className="flex h-12 items-center justify-center gap-2 rounded-full bg-chalk/10 text-[15px] font-medium text-chalk">
            <MessageSquare className="size-4" aria-hidden="true" /> Text
          </a>
        </div>
      </div>
    </>
  );
}
