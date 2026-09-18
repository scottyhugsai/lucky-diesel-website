'use client';

import Link from 'next/link';
import { ChevronRight, X } from 'lucide-react';
import { useEffect } from 'react';
import { RecentlyViewed } from './RecentlyViewed';
import type { NavLink } from '@/lib/site-nav';
import { moreFor } from './nav';

interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  links?: readonly NavLink[];
}

/** Bottom sheet behind the More tab. Everything that is not one of the four primary destinations. */
export function MoreSheet({ isOpen, onClose, links = moreFor() }: MoreSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  return (
    <div id="v3-more-sheet" hidden={!isOpen} className="fixed inset-0 z-[45] lg:hidden">
      <button type="button" aria-label="Close menu" onClick={onClose} className="v3-scrim absolute inset-0" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="v3-more-title"
        className="v3-sheet absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[12px] border-t border-line px-4 pt-3"
      >
        <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-chalk/25" />
        <div className="mt-3 flex items-center justify-between">
          <h2 id="v3-more-title" className="v3-title text-lg font-semibold">More</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded-full text-chalk/70"><X className="size-5" aria-hidden="true" /></button>
        </div>
        <RecentlyViewed onNavigate={onClose} />
        <nav aria-label="More">
          <ul className="mt-2 divide-y divide-line">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} onClick={onClose} className="flex min-h-13 items-center justify-between text-[1.0625rem] font-medium text-chalk active:text-clover">
                  {link.label}
                  <ChevronRight className="size-4 text-steel" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
