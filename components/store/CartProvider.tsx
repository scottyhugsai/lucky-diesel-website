'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  addToCart, cartCount, cartSubtotalCents, parseStoredCart, removeFromCart, setQuantity, type CartLine,
} from '@/lib/store/cart';
import {
  decodeTruck, encodeTruck, TRUCK_COOKIE, TRUCK_COOKIE_MAX_AGE, truckFromSelection, type SavedTruck,
} from '@/lib/fitment/truck-cookie';
import type { TruckSelection } from '@/lib/store/normalize';

const CART_KEY = 'ld_cart_v1';
/** Where the truck used to live. Read once so an existing visitor keeps theirs. */
const LEGACY_TRUCK_KEY = 'ld_truck_v1';

interface StoreState {
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  isCartOpen: boolean;
  /** Visitor's saved truck, used for fitment everywhere in the store and planner. */
  truck: TruckSelection | null;
  /** The same truck plus the year/engine pick behind it, when there was one. */
  savedTruck: SavedTruck | null;
  /** False until the cookie has been read, so server-rendered fitment stays authoritative. */
  truckReady: boolean;
  add: (line: CartLine) => void;
  addMany: (lines: CartLine[]) => void;
  update: (variantId: number, quantity: number) => void;
  remove: (variantId: number) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
  setTruck: (truck: TruckSelection | null) => void;
  /** Adopt the truck the server just rendered from the cookie. */
  syncTruck: (truck: SavedTruck | null) => void;
}

const StoreContext = createContext<StoreState | null>(null);

function read<T>(key: string, parse: (value: unknown) => T, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? parse(JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing / storage blocked: the cart still works for this page view.
  }
}

/** The truck cookie is shared with the server, which URL-encodes what it writes. */
function readTruckCookie(): SavedTruck | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${TRUCK_COOKIE}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return decodeTruck(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function writeTruckCookie(saved: SavedTruck | null) {
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  const base = `${TRUCK_COOKIE}=${saved ? encodeURIComponent(encodeTruck(saved)) : ''}; path=/; samesite=lax${secure}`;
  document.cookie = `${base}; max-age=${saved ? TRUCK_COOKIE_MAX_AGE : 0}`;
}

const asRecord = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? value as Record<string, unknown> : {});

/** A visitor from before the cookie existed keeps the truck they already chose. */
function adoptLegacyTruck(): SavedTruck | null {
  const stored = read<Record<string, unknown>>(LEGACY_TRUCK_KEY, asRecord, {});
  return truckFromSelection(stored.platform, stored.generationCollection);
}

const sameTruck = (a: TruckSelection | null, b: TruckSelection | null) =>
  a?.platform === b?.platform && a?.generationCollection === b?.generationCollection;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [savedTruck, setSavedTruck] = useState<SavedTruck | null>(null);
  const [isCartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Browser-only storage has to be read after mount to avoid a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines(read(CART_KEY, parseStoredCart, []));
    const cookieTruck = readTruckCookie();
    const adopted = cookieTruck ?? adoptLegacyTruck();
    if (!cookieTruck && adopted) writeTruckCookie(adopted);
    setSavedTruck(adopted);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) write(CART_KEY, lines);
  }, [lines, hydrated]);

  const setTruck = useCallback((next: TruckSelection | null) => {
    setSavedTruck((current) => {
      // Re-picking the same truck keeps the year and engine behind it.
      const keep = current && sameTruck(current.selection, next) ? current.fitment : null;
      const built = next ? truckFromSelection(next.platform, next.generationCollection) : null;
      const saved = built && keep ? { ...built, fitment: keep } : built;
      writeTruckCookie(saved);
      return saved;
    });
    // Fitment badges and the filtered listing are rendered on the server: ask for them again.
    router.refresh();
  }, [router]);

  /** The server re-reads the cookie on every render; this keeps the client copy honest. */
  const syncTruck = useCallback((fromServer: SavedTruck | null) => {
    setSavedTruck((current) => (sameTruck(current?.selection ?? null, fromServer?.selection ?? null)
      && current?.fitment.year === fromServer?.fitment.year ? current : fromServer));
  }, []);

  const value = useMemo<StoreState>(() => ({
    lines,
    count: cartCount(lines),
    subtotalCents: cartSubtotalCents(lines),
    isCartOpen,
    truck: savedTruck?.selection ?? null,
    savedTruck,
    truckReady: hydrated,
    add: (line) => { setLines((current) => addToCart(current, line)); setCartOpen(true); },
    addMany: (many) => { setLines((current) => many.reduce(addToCart, current)); setCartOpen(true); },
    update: (variantId, quantity) => setLines((current) => setQuantity(current, variantId, quantity)),
    remove: (variantId) => setLines((current) => removeFromCart(current, variantId)),
    clear: () => setLines([]),
    openCart: () => setCartOpen(true),
    closeCart: () => setCartOpen(false),
    setTruck,
    syncTruck,
  }), [lines, isCartOpen, savedTruck, hydrated, setTruck, syncTruck]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used inside <CartProvider>');
  return context;
}
