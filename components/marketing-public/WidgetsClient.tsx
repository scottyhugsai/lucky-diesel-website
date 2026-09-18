'use client';

import type { Design } from '@/lib/design';

import { MessageSquare } from 'lucide-react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AnnouncementBar } from './AnnouncementBar';
import { useConsent } from './consent';
import { useExitIntent, useDynamicNumber, usePopupTrigger, useReferralCapture } from './hooks';
import { useRememberPage } from './ResumeCard';
import type { WidgetMagnet, WidgetOffer } from './widget-data';
import { pickPopup, type Announcement, type PopupRule } from '@/lib/marketing/engage/rules';
import type { TagConfig } from '@/lib/marketing/engage/tags';

const OfferDialog = dynamic(() => import('./OfferDialog').then((m) => m.OfferDialog), { ssr: false });
const ChatPanel = dynamic(() => import('./ChatPanel').then((m) => m.ChatPanel), { ssr: false });
const PopupDialog = dynamic(() => import('./PopupDialog').then((m) => m.PopupDialog), { ssr: false });
const ConsentBanner = dynamic(() => import('./ConsentBanner').then((m) => m.ConsentBanner), { ssr: false });
const TagLoader = dynamic(() => import('./TagLoader').then((m) => m.TagLoader), { ssr: false });
const ResumeCard = dynamic(() => import('./ResumeCard').then((m) => m.ResumeCard), { ssr: false });
const SocialProofToast = dynamic(() => import('./SocialProofToast').then((m) => m.SocialProofToast), { ssr: false });

/** Paths where a popup or bubble would get in the way of the page's own job. */
const NO_OFFER = [/^\/login/, /^\/book/, /^\/portal/, /^\/shop/, /^\/l\//, /^\/events/, /^\/refer/, /^\/design/];
const NO_BUBBLE = [/^\/login/, /^\/book/, /^\/portal/, /^\/shop/];
const NO_EXTRAS = [/^\/login/, /^\/portal/, /^\/shop/, /^\/design/];

interface WidgetsClientProps {
  design: Design;
  magnet: WidgetMagnet | null;
  offer: WidgetOffer | null;
  announcement: Announcement | null;
  popups: readonly PopupRule[];
  socialProof: string | null;
  /** Tracking number for this visitor's source, swapped into tel:/sms: links. */
  dynamicPhone: string | null;
  /** Null when no tag id is configured, so nothing third-party loads. */
  tags: TagConfig | null;
  privacyVersion: string;
}

export function WidgetsClient({ design, magnet, offer, announcement, popups, socialProof, dynamicPhone, tags, privacyVersion }: WidgetsClientProps) {
  const pathname = usePathname() ?? '/';
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [hasOpenedPanel, setHasOpenedPanel] = useState(false);
  const canOffer = Boolean(magnet || offer) && !NO_OFFER.some((re) => re.test(pathname));
  const [isOfferOpen, closeOffer] = useExitIntent(canOffer);
  const quiet = NO_EXTRAS.some((re) => re.test(pathname));
  const popup = quiet ? null : pickPopup(popups, pathname, new Date());
  const [isPopupOpen, closePopup] = usePopupTrigger(isOfferOpen ? null : popup);
  const consent = useConsent(privacyVersion);
  useReferralCapture();
  useRememberPage(pathname);
  useDynamicNumber(dynamicPhone);

  // v3 already has a Call/Text pill in the thumb zone; a second bubble would stack on it.
  const showBubble = design !== 'v3' && !NO_BUBBLE.some((re) => re.test(pathname));

  return (
    <>
      {announcement && !quiet && <AnnouncementBar announcement={announcement} shifted={false} />}

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
          {hasOpenedPanel && <ChatPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />}
        </div>
      )}

      {isOfferOpen && <OfferDialog magnet={magnet} offer={offer} onClose={closeOffer} />}
      {popup && isPopupOpen && <PopupDialog popup={popup} onClose={closePopup} />}
      {!quiet && pathname === '/' && <ResumeCard />}
      {!quiet && socialProof && !isOfferOpen && !isPopupOpen && <SocialProofToast message={socialProof} />}
      {consent.isAsking && <ConsentBanner onSave={consent.save} />}
      {tags && <TagLoader config={tags} choice={consent.choice} />}
    </>
  );
}
