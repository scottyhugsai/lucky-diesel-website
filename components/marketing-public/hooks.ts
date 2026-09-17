'use client';

import { useEffect, useState } from 'react';

export const OFFER_SEEN_KEY = 'ld_offer_seen';
const WEEK_MS = 7 * 86_400_000;
const MOBILE_DELAY_MS = 45_000;
const MOBILE_SCROLL_DEPTH = 0.5;
const DESKTOP_MIN_DWELL_MS = 4_000;
const REF_PATTERN = /^[A-Za-z0-9-]{4,32}$/;

function recentlySeen(): boolean {
  try {
    const at = Number(window.localStorage.getItem(OFFER_SEEN_KEY));
    return Number.isFinite(at) && Date.now() - at < WEEK_MS;
  } catch {
    return true; // Storage blocked: never nag.
  }
}

export function markOfferSeen(): void {
  try {
    window.localStorage.setItem(OFFER_SEEN_KEY, String(Date.now()));
  } catch {
    // Storage blocked; the modal just may show again next week.
  }
}

/**
 * Desktop: pointer leaves through the top edge. Touch: 45s on the page and half-way scrolled.
 * At most once per 7 days per browser. `?offer=1` forces it (for testing and QA).
 */
export function useExitIntent(isEnabled: boolean): [boolean, () => void] {
  const [isTriggered, setIsTriggered] = useState(false);

  useEffect(() => {
    if (!isEnabled) return;
    const forced = new URLSearchParams(window.location.search).get('offer') === '1';
    if (forced) {
      const id = window.setTimeout(() => setIsTriggered(true), 300);
      return () => window.clearTimeout(id);
    }
    if (recentlySeen()) return;
    const fire = () => setIsTriggered(true);
    const isTouch = window.matchMedia('(pointer: coarse)').matches;

    if (!isTouch) {
      const start = Date.now();
      const onLeave = (event: MouseEvent) => {
        if (event.clientY <= 0 && !event.relatedTarget && Date.now() - start > DESKTOP_MIN_DWELL_MS) fire();
      };
      document.documentElement.addEventListener('mouseleave', onLeave);
      return () => document.documentElement.removeEventListener('mouseleave', onLeave);
    }

    let isTimeUp = false;
    let isDeepEnough = false;
    const check = () => { if (isTimeUp && isDeepEnough) fire(); };
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= MOBILE_SCROLL_DEPTH) {
        isDeepEnough = true;
        check();
      }
    };
    const timer = window.setTimeout(() => { isTimeUp = true; check(); }, MOBILE_DELAY_MS);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [isEnabled]);

  return [isTriggered, () => setIsTriggered(false)];
}

/** `?ref=CODE` on any page: the referral route validates the code and sets the `ld_ref` cookie. */
export function useReferralCapture(): void {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (!code || !REF_PATTERN.test(code)) return;
    const key = `ld_ref_sent_${code.toUpperCase()}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Session storage blocked: still capture once per page load.
    }
    fetch(`/api/marketing/referral?code=${encodeURIComponent(code)}`, { redirect: 'manual', credentials: 'same-origin' }).catch(() => undefined);
  }, []);
}

const POPUP_SEEN_PREFIX = 'ld_popup_';

/**
 * Fires a page popup after N seconds on the page ('time') or N% scrolled
 * ('scroll'). Once per popup per browser per 7 days.
 */
export function usePopupTrigger(popup: { id: string; trigger: 'time' | 'scroll'; triggerValue: number } | null): [boolean, () => void] {
  const [isTriggered, setIsTriggered] = useState(false);

  useEffect(() => {
    if (!popup) return;
    const key = `${POPUP_SEEN_PREFIX}${popup.id}`;
    try {
      const at = Number(window.localStorage.getItem(key));
      if (Number.isFinite(at) && Date.now() - at < WEEK_MS) return;
    } catch {
      return; // Storage blocked: never nag.
    }
    const fire = () => {
      try {
        window.localStorage.setItem(key, String(Date.now()));
      } catch {
        // Fine: it may show again.
      }
      setIsTriggered(true);
    };

    if (popup.trigger === 'time') {
      const timer = window.setTimeout(fire, Math.min(popup.triggerValue, 600) * 1000);
      return () => window.clearTimeout(timer);
    }
    const depth = Math.min(Math.max(popup.triggerValue, 1), 100) / 100;
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= depth) {
        window.removeEventListener('scroll', onScroll);
        fire();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [popup]);

  return [isTriggered, () => setIsTriggered(false)];
}

/**
 * Dynamic number insertion: rewrites every `tel:`/`sms:` link to the tracking
 * number mapped to this visitor's last-touch source, so calls are attributable.
 */
export function useDynamicNumber(phone: string | null): void {
  useEffect(() => {
    if (!phone) return;
    const display = `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
    for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"], a[href^="sms:"]')) {
      const scheme = link.href.startsWith('sms:') ? 'sms' : 'tel';
      const [, query] = link.href.split('?');
      link.href = `${scheme}:${phone}${query ? `?${query}` : ''}`;
      for (const node of Array.from(link.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent && /\(\d{3}\)\s?\d{3}-\d{4}/.test(node.textContent)) {
          node.textContent = node.textContent.replace(/\(\d{3}\)\s?\d{3}-\d{4}/, display);
        }
      }
    }
  }, [phone]);
}
