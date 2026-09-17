'use client';

import { MessageSquare } from 'lucide-react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useExitIntent, useReferralCapture } from './hooks';
import type { WidgetMagnet, WidgetOffer } from './widget-data';

const TextUsPanel = dynamic(() => import('./TextUsPanel').then((m) => m.TextUsPanel), { ssr: false });
const OfferDialog = dynamic(() => import('./OfferDialog').then((m) => m.OfferDialog), { ssr: false });

/** Paths where a popup or bubble would get in the way of the page's own job. */
const NO_OFFER = [/^\/login/, /^\/book/, /^\/portal/, /^\/shop/, /^\/l\//, /^\/events/, /^\/refer/, /^\/design/];
const NO_BUBBLE = [/^\/login/, /^\/book/, /^\/portal/, /^\/shop/];

interface WidgetsClientProps {
  design: 'v1' | 'v2' | 'v3';
  magnet: WidgetMagnet | null;
  offer: WidgetOffer | null;
}

export function WidgetsClient({ design, magnet, offer }: WidgetsClientProps) {
  const pathname = usePathname() ?? '/';
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [hasOpenedPanel, setHasOpenedPanel] = useState(false);
  const canOffer = Boolean(magnet || offer) && !NO_OFFER.some((re) => re.test(pathname));
  const [isOfferOpen, closeOffer] = useExitIntent(canOffer);
  useReferralCapture();

  // v3 already has a Call/Text pill in the thumb zone; a second bubble would stack on it.
  const showBubble = design !== 'v3' && !NO_BUBBLE.some((re) => re.test(pathname));

  return (
    <>
      {showBubble && (
        <div className="fixed right-3 z-40 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:right-5 lg:bottom-5">
          <button
            type="button"
            aria-expanded={isPanelOpen}
            aria-controls="text-us-panel"
            onClick={() => { setHasOpenedPanel(true); setIsPanelOpen((open) => !open); }}
            className="btn-go flex h-12 items-center gap-2 rounded-full px-4 text-sm font-bold shadow-[0_10px_30px_-8px_rgb(0_0_0/0.7)] [[data-design=v2]_&]:rounded-full"
          >
            <MessageSquare className="size-5" aria-hidden="true" />
            <span className="max-lg:sr-only">Text us</span>
          </button>
          {hasOpenedPanel && <TextUsPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />}
        </div>
      )}
      {isOfferOpen && <OfferDialog magnet={magnet} offer={offer} onClose={closeOffer} />}
    </>
  );
}
