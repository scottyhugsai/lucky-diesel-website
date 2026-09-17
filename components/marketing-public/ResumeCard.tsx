'use client';

import Link from 'next/link';
import { History, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { isSitePath } from '@/lib/marketing/engage/rules';
import { useBrowserValue } from './browser-value';

const KEY = 'ld_last_page';
const MAX_AGE_MS = 30 * 86_400_000;
const MIN_AGE_MS = 5 * 60_000;

interface LastPage { path: string; label: string; at: number }

/** Paths worth returning to, most specific first. */
const WORTH_RESUMING: readonly { test: RegExp; label: (path: string) => string }[] = [
  { test: /^\/build-planner/, label: () => 'your build plan' },
  { test: /^\/store\/products\//, label: () => 'the part you were looking at' },
  { test: /^\/builds\//, label: () => 'the build you were reading' },
  { test: /^\/(duramax|powerstroke|cummins)$/, label: (p) => `${p.slice(1)} services` },
];

/** Raw stored value, or `''` when none. */
function readRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

function parse(raw: string): LastPage | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LastPage>;
    if (!isSitePath(parsed.path) || typeof parsed.label !== 'string' || typeof parsed.at !== 'number') return null;
    // Old enough to be a real "last time", recent enough to still matter.
    const age = Date.now() - parsed.at;
    if (age < MIN_AGE_MS || age > MAX_AGE_MS) return null;
    return { path: parsed.path, label: parsed.label.slice(0, 60), at: parsed.at };
  } catch {
    return null;
  }
}

/** Remembers the last page worth coming back to. Nothing leaves the browser. */
export function useRememberPage(pathname: string): void {
  useEffect(() => {
    const match = WORTH_RESUMING.find((r) => r.test.test(pathname));
    if (!match) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ path: pathname, label: match.label(pathname), at: Date.now() } satisfies LastPage));
    } catch {
      // Storage blocked: no resume card, no harm.
    }
  }, [pathname]);
}

/** "Pick up where you left off" for a returning visitor. Home page only. */
export function ResumeCard() {
  const raw = useBrowserValue(readRaw);
  const [isClosed, setIsClosed] = useState(false);
  const last = useMemo(() => (raw ? parse(raw) : null), [raw]);

  if (!last || isClosed) return null;

  return (
    <aside
      aria-label="Pick up where you left off"
      className="fixed left-3 z-40 w-[min(19rem,calc(100vw-1.5rem))] bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:bottom-5"
    >
      <div className="relative grid gap-2 rounded-md border border-line bg-carbon-2/98 p-3 pr-9 shadow-[0_14px_40px_-14px_rgb(0_0_0/0.8)] backdrop-blur [[data-design=v2]_&]:rounded-2xl">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-steel">
          <History className="size-3.5 text-clover" aria-hidden="true" /> Last time
        </p>
        <Link href={last.path} onClick={() => setIsClosed(true)} className="font-semibold text-chalk underline-offset-4 hover:text-clover hover:underline">
          Back to {last.label}
        </Link>
        <button type="button" onClick={() => setIsClosed(true)} aria-label="Dismiss" className="absolute right-2 top-2 grid size-7 place-items-center rounded-sm text-chalk/60 hover:text-chalk">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
