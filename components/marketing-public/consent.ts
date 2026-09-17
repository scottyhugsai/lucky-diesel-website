'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  CONSENT_COOKIE, CONSENT_MAX_AGE_SECONDS, encodeConsent, needsConsentPrompt, parseConsent, type ConsentChoice,
} from '@/lib/marketing/engage/rules';
import { useBrowserValue } from './browser-value';

/** Raw cookie value, or `''` when there is none. Never null: null means "not read yet". */
function readCookie(): string {
  try {
    const raw = document.cookie.split('; ').find((c) => c.startsWith(`${CONSENT_COOKIE}=`))?.slice(CONSENT_COOKIE.length + 1);
    return raw ? decodeURIComponent(raw) : '';
  } catch {
    return '';
  }
}

function writeCookie(choice: ConsentChoice): void {
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(encodeConsent(choice))}; path=/; max-age=${CONSENT_MAX_AGE_SECONDS}; samesite=lax${secure}`;
}

export interface ConsentState {
  /** null until the cookie has been read on the client. */
  choice: ConsentChoice | null;
  isAsking: boolean;
  save: (next: { analytics: boolean; ads: boolean }) => void;
}

/**
 * The visitor's cookie choice. Nothing beyond our own first-party measurement
 * runs until they answer, and an older policy version asks again.
 */
export function useConsent(version: string): ConsentState {
  const raw = useBrowserValue(readCookie);
  const [saved, setSaved] = useState<ConsentChoice | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const stored = useMemo(() => (raw === null ? null : parseConsent(raw || null)), [raw]);

  const choice = saved ?? stored;
  const isAsking = raw !== null && !isAnswered && needsConsentPrompt(choice, version);

  const save = useCallback((next: { analytics: boolean; ads: boolean }) => {
    const value: ConsentChoice = { ...next, version };
    writeCookie(value);
    setSaved(value);
    setIsAnswered(true);
    void fetch('/api/marketing/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ event: 'consent', analytics: next.analytics, ads: next.ads }),
    }).catch(() => undefined);
  }, [version]);

  return { choice, isAsking, save };
}
