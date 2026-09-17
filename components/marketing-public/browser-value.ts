'use client';

import { useSyncExternalStore } from 'react';

/** Storage changes in other tabs; enough to keep a read in sync without polling. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

const serverSnapshot = () => null;

/**
 * A browser-only string (cookie or localStorage), read after hydration so the
 * server and client markup match. `null` means "not read yet"; read functions
 * should return a sentinel (e.g. `''`) for "read, nothing stored".
 */
export function useBrowserValue(read: () => string): string | null {
  return useSyncExternalStore(subscribe, read, serverSnapshot);
}
