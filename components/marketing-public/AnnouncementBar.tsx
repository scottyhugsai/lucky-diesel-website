'use client';

import Link from 'next/link';
import { Megaphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { announcementId, countdownLabel, type Announcement } from '@/lib/marketing/engage/rules';
import { useBrowserValue } from './browser-value';

const DISMISS_KEY = 'ld_bar_dismissed';
const TICK_MS = 60_000;

interface AnnouncementBarProps {
  announcement: Announcement;
  /** True when the hours-notice banner already owns the slot under the header. */
  shifted: boolean;
}

/** Dismissed announcement id, or `''` when none. */
function readDismissed(): string {
  try {
    return window.localStorage.getItem(DISMISS_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Owner-set bar under the header, with an optional countdown. Dismissal is per announcement. */
export function AnnouncementBar({ announcement, shifted }: AnnouncementBarProps) {
  const id = announcementId(announcement);
  const dismissed = useBrowserValue(readDismissed);
  const [isClosed, setIsClosed] = useState(false);
  const [left, setLeft] = useState<string | null>(null);
  // null until the client has read storage, so server and client markup match.
  const isOpen = dismissed !== null && dismissed !== id && !isClosed;

  useEffect(() => {
    if (!isOpen || !announcement.countdown) return;
    const update = () => setLeft(countdownLabel(announcement.endsAt, new Date()));
    update();
    const timer = window.setInterval(update, TICK_MS);
    return () => window.clearInterval(timer);
  }, [isOpen, announcement.countdown, announcement.endsAt]);

  if (!isOpen) return null;

  const top = shifted
    ? 'top-26 [[data-design=v2]_&]:top-20 [[data-design=v3]_&]:top-22'
    : 'top-18 [[data-design=v2]_&]:top-12 [[data-design=v3]_&]:top-14';

  function dismiss() {
    setIsClosed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, id);
    } catch {
      // Fine: it just shows again next visit.
    }
  }

  return (
    <aside aria-label="Announcement" className={`fixed inset-x-0 z-40 border-b border-clover/30 bg-carbon/95 px-4 py-1.5 text-sm text-chalk backdrop-blur-xl ${top}`}>
      <p className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1 pr-7">
        <Megaphone className="size-4 shrink-0 text-clover" aria-hidden="true" />
        <span>{announcement.text}</span>
        {left && <span className="rounded-sm bg-clover/15 px-1.5 font-semibold tabular-nums text-clover">{left}</span>}
        {announcement.href && (
          <Link href={announcement.href} className="font-semibold text-clover underline-offset-4 hover:underline">
            {announcement.linkLabel ?? 'See it'}
          </Link>
        )}
      </p>
      <button type="button" onClick={dismiss} aria-label="Dismiss announcement" className="absolute right-3 top-1.5 grid size-6 place-items-center rounded-sm text-chalk/60 hover:text-chalk">
        <X className="size-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
