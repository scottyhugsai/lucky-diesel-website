'use client';

import { usePathname } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MONO } from './ui';
import { RECENT_KEY, RECENT_LIMIT, parseRecent, type RecentProduct } from './nav';

const PRODUCT_PATH = /^\/store\/products\/[^/]+$/;
/** The buy box's quantity group: the only element inside ProductBuyBox with a stable accessible name. */
const BUY_ROW_SELECTOR = '[role="group"][aria-label="Quantity"]';

interface Snapshot {
  title: string;
  price: string | null;
  canBuy: boolean;
}

function readSnapshot(): Snapshot | null {
  const title = document.querySelector('main h1')?.textContent?.trim();
  if (!title) return null;
  const price = document.querySelector<HTMLElement>('main p[aria-live="polite"]')?.firstChild?.textContent?.trim() ?? null;
  const addButton = buyRow()?.parentElement?.querySelector<HTMLButtonElement>('button:not([aria-label])');
  return { title, price, canBuy: Boolean(addButton && !addButton.disabled) };
}

function buyRow(): HTMLElement | null {
  return document.querySelector<HTMLElement>(BUY_ROW_SELECTOR);
}

/** The gallery image's original URL: next/image serves it through /_next/image, which cannot be fed back into next/image. */
function originalImageSrc(): string | null {
  const src = document.querySelector<HTMLImageElement>('main img')?.currentSrc;
  if (!src) return null;
  try {
    const url = new URL(src, window.location.origin);
    return url.pathname === '/_next/image' ? url.searchParams.get('url') : src;
  } catch {
    return null;
  }
}

function rememberProduct(handle: string, snapshot: Snapshot) {
  try {
    const image = originalImageSrc();
    const raw = window.localStorage.getItem(RECENT_KEY);
    const existing = raw ? parseRecent(JSON.parse(raw)) : [];
    const next: RecentProduct[] = [{ handle, title: snapshot.title, price: snapshot.price, image }, ...existing.filter((p) => p.handle !== handle)].slice(0, RECENT_LIMIT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: recently viewed simply stays empty.
  }
}

/**
 * Product pages only. When the buy box scrolls off, a compact bar takes its place.
 * "Add" forwards to the real Add-to-cart button so cart logic stays in one place.
 */
export function StickyBuyBar() {
  const pathname = usePathname();
  const isProductPage = PRODUCT_PATH.test(pathname);
  // State carries the pathname it was read for, so a navigation renders nothing until the new page is observed.
  const [state, setState] = useState<{ path: string; snapshot: Snapshot | null; isShown: boolean }>({ path: '', snapshot: null, isShown: false });

  useEffect(() => {
    if (!isProductPage) return;
    const row = buyRow();
    if (!row) return;
    let remembered = false;

    // IntersectionObserver fires once on observe(), which doubles as the initial DOM read.
    const observer = new IntersectionObserver(([entry]) => {
      const snapshot = readSnapshot();
      if (snapshot && !remembered) {
        remembered = true;
        rememberProduct(pathname.split('/').pop() ?? '', snapshot);
      }
      // Only once the row has left through the top: not while it is still below the fold on load.
      const isShown = Boolean(entry && !entry.isIntersecting && entry.boundingClientRect.top < 0);
      setState({ path: pathname, snapshot, isShown });
    });
    observer.observe(row);
    // Variant and price changes happen inside the buy box; keep the snapshot in sync.
    const mutation = new MutationObserver(() => setState((current) => ({ ...current, path: pathname, snapshot: readSnapshot() })));
    const box = row.parentElement?.parentElement;
    if (box) mutation.observe(box, { subtree: true, characterData: true, childList: true, attributes: true, attributeFilter: ['disabled'] });
    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, [pathname, isProductPage]);

  const snapshot = state.path === pathname ? state.snapshot : null;
  const isShown = state.path === pathname && state.isShown;
  if (!isProductPage || !snapshot) return null;

  const scrollToBuyBox = () => buyRow()?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const add = () => {
    const button = buyRow()?.parentElement?.querySelector<HTMLButtonElement>('button:not([aria-label])');
    if (button && !button.disabled) button.click();
    else scrollToBuyBox();
  };

  return (
    <div
      aria-hidden={!isShown}
      className={`v3-bar v3-buybar fixed inset-x-0 z-40 border-t border-line transition-[transform,opacity] duration-300 ${isShown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}
    >
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2 sm:px-6">
        <button type="button" onClick={scrollToBuyBox} className="min-w-0 flex-1 text-left" tabIndex={isShown ? 0 : -1}>
          <p className="truncate text-sm font-semibold text-chalk">{snapshot.title}</p>
          {snapshot.price && <p className={`${MONO} text-sm text-clover`}>{snapshot.price}</p>}
        </button>
        <button
          type="button"
          onClick={add}
          tabIndex={isShown ? 0 : -1}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[6px] bg-clover px-4 text-sm font-semibold text-carbon hover:brightness-110 active:scale-[0.98]"
        >
          <ShoppingBag className="size-4" aria-hidden="true" /> {snapshot.canBuy ? 'Add to cart' : 'View options'}
        </button>
      </div>
    </div>
  );
}
