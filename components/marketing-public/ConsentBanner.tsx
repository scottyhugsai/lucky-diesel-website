'use client';

import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { useState } from 'react';

interface ConsentBannerProps {
  onSave: (choice: { analytics: boolean; ads: boolean }) => void;
}

/** Cookie choice. Shown once per policy version; nothing optional loads before an answer. */
export function ConsentBanner({ onSave }: ConsentBannerProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [ads, setAds] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 z-50 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] px-3 lg:bottom-4"
    >
      <div className="mx-auto grid max-w-3xl gap-2 rounded-md border border-line bg-carbon-2/98 p-3 sm:gap-3 sm:p-4 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.8)] backdrop-blur [[data-design=v2]_&]:rounded-2xl">
        <p id="consent-title" className="flex items-center gap-2 font-semibold">
          <Cookie className="size-4 shrink-0 text-clover" aria-hidden="true" /> Cookies
        </p>
        {/* The long sentence costs three lines on a 320px screen, where this
            sheet sits directly over the hero's truck picker. The short form says
            the same thing; the full one returns as soon as there is room. */}
        <p className="text-sm text-chalk/70">
          <span className="sm:hidden">Analytics and ad cookies are yours to allow.{' '}</span>
          <span className="hidden sm:inline">We always count our own page views. Analytics and ad cookies are yours to allow.{' '}</span>
          <Link href="/privacy#tracking" className="underline underline-offset-2 hover:text-clover">How we track</Link>
        </p>

        {isCustom && (
          <fieldset className="grid gap-2">
            <legend className="sr-only">Cookie categories</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-chalk/80">
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="size-4 accent-[var(--clover)]" />
              Analytics — which pages help
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-chalk/80">
              <input type="checkbox" checked={ads} onChange={(e) => setAds(e.target.checked)} className="size-4 accent-[var(--clover)]" />
              Ads — measure our ads
            </label>
          </fieldset>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onSave({ analytics: true, ads: true })} className="btn-go h-11 rounded-sm px-4 text-sm font-bold [[data-design=v2]_&]:rounded-lg">
            Allow all
          </button>
          <button type="button" onClick={() => onSave({ analytics: false, ads: false })} className="h-11 rounded-sm border border-chalk/25 px-4 text-sm font-semibold hover:border-clover hover:text-clover [[data-design=v2]_&]:rounded-lg">
            Essential only
          </button>
          {isCustom ? (
            <button type="button" onClick={() => onSave({ analytics, ads })} className="h-11 rounded-sm px-3 text-sm font-semibold text-chalk/70 underline-offset-4 hover:text-clover hover:underline">
              Save choices
            </button>
          ) : (
            <button type="button" onClick={() => setIsCustom(true)} className="h-11 rounded-sm px-3 text-sm font-semibold text-chalk/70 underline-offset-4 hover:text-clover hover:underline">
              Choose
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
