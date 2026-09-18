'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { trackEvent } from './analytics';
import { contactClick, pickRegion } from './contact-clicks';

/**
 * Measures every call and text on the site from one place.
 *
 * Phone is the dominant channel for this business and it was entirely
 * uninstrumented: `trackEvent` was called from a single component, so the hero
 * number, the mobile action bar and every product page's Call/Text pair
 * recorded nothing. Those links are server-rendered, so a delegated listener is
 * the only way to reach them without turning each page into a client
 * component — and it picks up any link added later for free.
 *
 * Renders nothing. A blocked tag never breaks the navigation, because the event
 * is fired before the browser hands the `tel:` URL to the dialler and
 * `trackEvent` swallows its own failures.
 */
export function ContactClicks() {
  const pathname = usePathname();

  // Re-attached per route rather than held in a ref, so the path it reports is
  // always the page the click happened on.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!anchor) return;
      // The nearest identified region, which is how the sections are already
      // labelled for the in-page nav — no extra markup needed. Ids are walked
      // outward so the closest meaningful one wins over the page wrapper.
      const ids: string[] = [];
      for (let node: HTMLElement | null = anchor; node; node = node.parentElement) {
        if (node.id) ids.push(node.id);
      }
      const region = pickRegion(ids);
      const hit = contactClick(anchor.getAttribute('href'), region, pathname);
      if (hit) trackEvent(hit.event, { source: hit.source });
    }
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, [pathname]);

  return null;
}
