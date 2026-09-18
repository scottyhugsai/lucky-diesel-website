'use client';

import { useEffect } from 'react';
import { parseRecent, RECENT_COOKIE, RECENT_COOKIE_MAX_AGE, withRecent } from './recent';

/**
 * Notes that this part was looked at, so the store can offer it again. Renders
 * nothing, and the store reads the result on the server.
 */
export function RecordRecent({ handle }: { handle: string }) {
  useEffect(() => {
    try {
      const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${RECENT_COOKIE}=([^;]*)`));
      const next = withRecent(parseRecent(match?.[1] ? decodeURIComponent(match[1]) : ''), handle);
      const secure = window.location.protocol === 'https:' ? '; secure' : '';
      document.cookie = `${RECENT_COOKIE}=${next.join(',')}; path=/; max-age=${RECENT_COOKIE_MAX_AGE}; samesite=lax${secure}`;
    } catch {
      // Storage blocked: the store simply has nothing to show later.
    }
  }, [handle]);
  return null;
}
