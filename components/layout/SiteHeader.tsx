'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Menu, MessageSquare, Phone, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BUSINESS } from '@/lib/site';

const NAV = [
  { href: '/#trucks', label: 'Trucks' },
  { href: '/#services', label: 'Services' },
  { href: '/builds', label: 'Builds' },
  { href: '/#parts', label: 'Parts & tuning' },
  { href: '/#quote', label: 'Contact' },
] as const;

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setIsScrolled(!entry?.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    if (!isMenuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setIsMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="absolute top-0 h-8 w-px" />
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
          isScrolled || isMenuOpen
            ? 'border-b border-line bg-carbon/85 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3" onClick={closeMenu} aria-label="Lucky Diesel home">
            <Image src="/images/logo-mark.png" alt="" width={48} height={34} priority className="h-9 w-auto" />
            <span className="display text-[1.55rem] not-italic leading-none tracking-tight">
              <span className="text-clover">Lucky</span> Diesel
            </span>
          </Link>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-8 text-[0.95rem] font-semibold text-chalk/80">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="relative py-2 transition-colors hover:text-chalk after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-clover after:transition-transform after:duration-300 hover:after:scale-x-100">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden items-center gap-5 lg:flex">
            <a href={BUSINESS.phoneHref} className="flex items-center gap-2 font-semibold tabular-nums transition-colors hover:text-clover">
              <Phone className="size-4 text-clover" aria-hidden="true" />
              {BUSINESS.phoneDisplay}
            </a>
            <Link href="/login" className="text-[0.95rem] font-semibold text-chalk/80 transition-colors hover:text-clover">
              Log in
            </Link>
            <Link href="/#quote" className="btn-go display rounded-sm px-5 py-2.5 text-lg not-italic">
              Get a quote
            </Link>
          </div>

          <button
            type="button"
            className="grid size-11 place-items-center rounded-full border border-line lg:hidden"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        <div
          id="mobile-menu"
          hidden={!isMenuOpen}
          className="h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-line bg-carbon px-4 pb-10 pt-8 lg:hidden"
        >
          <nav aria-label="Mobile">
            <ul className="space-y-1">
              {NAV.map((item, index) => (
                <li key={item.href} className="rise" style={{ '--rise-delay': `${index * 60}ms` } as React.CSSProperties}>
                  <a href={item.href} onClick={closeMenu} className="display block py-2 text-6xl text-chalk active:text-clover">
                    {item.label}
                  </a>
                </li>
              ))}
              <li className="rise" style={{ '--rise-delay': '300ms' } as React.CSSProperties}>
                <Link href="/login" onClick={closeMenu} className="display block py-2 text-6xl text-clover">
                  Log in
                </Link>
              </li>
            </ul>
          </nav>
          <div className="mt-10 grid grid-cols-2 gap-3">
            <a href={BUSINESS.phoneHref} className="btn-go flex items-center justify-center gap-2 rounded-sm py-4 font-semibold">
              <Phone className="size-5" aria-hidden="true" /> Call
            </a>
            <a href={BUSINESS.smsHref} className="flex items-center justify-center gap-2 rounded-sm border border-line py-4 font-semibold">
              <MessageSquare className="size-5" aria-hidden="true" /> Text
            </a>
          </div>
        </div>
      </header>
    </>
  );
}
