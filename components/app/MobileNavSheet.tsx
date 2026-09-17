'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NavItem } from './AppNav';
import { NAV_ICONS } from './icons';

/**
 * Phone access to every area. The bottom bar only fits five tabs, so sections
 * like Marketing, Gallery, Team and Settings are reachable here.
 */
export function MobileNavSheet({ items, area }: { items: NavItem[]; area: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portals need a client-side mount
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setIsOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls="admin-menu"
        className="flex h-9 items-center gap-1.5 rounded-sm border border-line px-2.5 text-xs font-semibold text-chalk/80"
      >
        <Menu className="size-4" aria-hidden="true" /> Menu
      </button>

      {mounted && isOpen && createPortal(
      <div
        id="admin-menu"
        role="dialog"
        aria-modal="true"
        aria-label={`${area} menu`}
        className="fixed inset-0 z-50 overflow-y-auto bg-carbon px-4 pb-24 pt-[calc(env(safe-area-inset-top,0px)+1rem)] lg:hidden"
      >
        <div className="flex items-center justify-between">
          <p className="kicker">{area}</p>
          <button type="button" onClick={() => setIsOpen(false)} className="grid size-10 place-items-center rounded-full border border-line" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <ul className="mt-6 grid gap-1">
          {items.map((item) => {
            const Icon = NAV_ICONS[item.icon];
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-14 items-center gap-3 rounded-sm px-3 text-lg font-semibold ${active ? 'bg-clover/10 text-clover' : 'text-chalk/85 active:bg-gunmetal'}`}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? <span className="rounded-full bg-clover px-2 text-sm font-bold text-carbon tabular-nums">{item.badge}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>,
      document.body,
      )}
    </>
  );
}
