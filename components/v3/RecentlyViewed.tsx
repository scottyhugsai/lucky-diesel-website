'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { MONO } from './ui';
import { RECENT_KEY, parseRecent, type RecentProduct } from './nav';

const EMPTY: RecentProduct[] = [];
let cache: { raw: string | null; items: RecentProduct[] } = { raw: null, items: EMPTY };

/** Stable snapshot: re-parses only when the stored string changes, so useSyncExternalStore does not loop. */
function getSnapshot(): RecentProduct[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(RECENT_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cache.raw) {
    let items = EMPTY;
    try {
      items = raw ? parseRecent(JSON.parse(raw)) : EMPTY;
    } catch {
      items = EMPTY;
    }
    cache = { raw, items };
  }
  return cache.items;
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/** Products this visitor opened, from localStorage. Empty on the server and when nothing is stored. */
export function RecentlyViewed({ onNavigate }: { onNavigate?: () => void }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  if (!items.length) return null;

  return (
    <section aria-labelledby="v3-recent-title" className="mt-4">
      <h3 id="v3-recent-title" className={`${MONO} text-xs uppercase tracking-[0.14em] text-steel`}>Recently viewed</h3>
      <ul className="v3-scroll -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
        {items.map((item) => (
          <li key={item.handle} className="w-36 shrink-0">
            <Link href={`/store/products/${item.handle}`} onClick={onNavigate} className="block rounded-[8px] border border-line bg-carbon p-2 active:border-clover">
              <div className="relative aspect-square overflow-hidden rounded-[6px] bg-chalk">
                {item.image && <Image src={item.image} alt="" fill sizes="144px" className="object-contain p-1" />}
              </div>
              <p className="mt-2 line-clamp-2 text-xs font-medium leading-snug text-chalk">{item.title}</p>
              {item.price && <p className={`${MONO} mt-1 text-xs text-clover`}>{item.price}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
