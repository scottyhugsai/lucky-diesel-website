'use client';

import { Activity, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const SEEN_KEY = 'ld_proof_seen';
const DAY_MS = 86_400_000;
const DELAY_MS = 12_000;

/**
 * One toast with a real count from this week's shop work. Capped at once a day,
 * and it never appears when the count is too low to be worth saying.
 */
export function SocialProofToast({ message }: { message: string }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const at = Number(window.localStorage.getItem(SEEN_KEY));
      if (Number.isFinite(at) && Date.now() - at < DAY_MS) return;
    } catch {
      return;
    }
    const timer = window.setTimeout(() => {
      setIsOpen(true);
      try {
        window.localStorage.setItem(SEEN_KEY, String(Date.now()));
      } catch {
        // Fine: it may show again.
      }
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      role="status"
      className="fixed left-3 z-40 w-[min(18rem,calc(100vw-1.5rem))] bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:bottom-5"
    >
      <div className="relative flex items-start gap-2 rounded-md border border-line bg-carbon-2/98 p-3 pr-9 text-sm shadow-[0_14px_40px_-14px_rgb(0_0_0/0.8)] backdrop-blur [[data-design=v2]_&]:rounded-2xl">
        <Activity className="mt-0.5 size-4 shrink-0 text-clover" aria-hidden="true" />
        <p className="text-chalk/85">{message}</p>
        <button type="button" onClick={() => setIsOpen(false)} aria-label="Dismiss" className="absolute right-2 top-2 grid size-7 place-items-center rounded-sm text-chalk/60 hover:text-chalk">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
