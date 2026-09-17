'use client';

import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useRef } from 'react';
import { PLATFORMS } from '@/lib/site';
import { altText, categoryLabel, type GalleryPhoto } from './constants';

const SWIPE_MIN_PX = 48;
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface LightboxProps {
  photos: GalleryPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const navButton =
  'grid size-12 place-items-center rounded-full border border-chalk/15 bg-carbon/70 text-chalk backdrop-blur transition-colors hover:border-clover hover:text-clover disabled:opacity-30';

export function Lightbox({ photos, index, onIndexChange, onClose }: LightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const titleId = useId();
  const photo = photos[index]!;
  const total = photos.length;
  const go = (delta: number) => onIndexChange((index + delta + total) % total);

  // Lock page scroll and move focus into the dialog while it is open.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowRight' && total > 1) {
      go(1);
    } else if (event.key === 'ArrowLeft' && total > 1) {
      go(-1);
    } else if (event.key === 'Tab') {
      trapFocus(event, dialogRef.current);
    }
  }

  function handleTouchEnd(event: React.TouchEvent) {
    const start = touchX.current;
    touchX.current = null;
    const end = event.changedTouches[0]?.clientX;
    if (start === null || end === undefined || total < 2) return;
    const dx = end - start;
    if (Math.abs(dx) >= SWIPE_MIN_PX) go(dx < 0 ? 1 : -1);
  }

  const platform = PLATFORMS.find((p) => p.id === photo.platform)?.name;
  const meta = [photo.vehicleLabel, platform, categoryLabel(photo.category)].filter(Boolean).join(' · ');

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[100] flex flex-col bg-carbon/95 backdrop-blur-xl motion-safe:animate-[lb-in_200ms_ease-out]"
    >
      <style>{'@keyframes lb-in{from{opacity:0}to{opacity:1}}'}</style>
      <div className="flex items-center justify-between gap-4 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <p className="text-sm font-semibold tabular-nums text-chalk/70" aria-live="polite">
          {index + 1} / {total}
        </p>
        <button ref={closeRef} type="button" onClick={onClose} className={navButton} aria-label="Close gallery">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-20"
        onTouchStart={(event) => (touchX.current = event.touches[0]?.clientX ?? null)}
        onTouchEnd={handleTouchEnd}
        onClick={(event) => event.target === event.currentTarget && onClose()}
      >
        <Image
          key={photo.id}
          src={photo.src}
          alt={altText(photo)}
          width={photo.width}
          height={photo.height}
          sizes="(min-width: 640px) calc(100vw - 10rem), 100vw"
          className="h-auto max-h-full w-auto max-w-full object-contain [[data-design=v2]_&]:rounded-2xl motion-safe:animate-[lb-in_250ms_ease-out]"
          priority
        />
        {total > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className={`${navButton} absolute left-3 top-1/2 hidden -translate-y-1/2 sm:grid`} aria-label="Previous photo">
              <ChevronLeft className="size-6" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(1)} className={`${navButton} absolute right-3 top-1/2 hidden -translate-y-1/2 sm:grid`} aria-label="Next photo">
              <ChevronRight className="size-6" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-steel [[data-design=v2]_&]:normal-case [[data-design=v2]_&]:tracking-normal">
            {meta}
            {photo.isSample && <span className="ml-2 text-chalk/50">· Example</span>}
          </p>
          <h2 id={titleId} className="display mt-1 text-3xl sm:text-4xl">{photo.title}</h2>
          {photo.caption && <p className="mt-1 max-w-2xl text-chalk/70">{photo.caption}</p>}
        </div>
        <div className="flex items-center gap-2">
          {total > 1 && (
            <span className="flex gap-2 sm:hidden">
              <button type="button" onClick={() => go(-1)} className={navButton} aria-label="Previous photo">
                <ChevronLeft className="size-6" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => go(1)} className={navButton} aria-label="Next photo">
                <ChevronRight className="size-6" aria-hidden="true" />
              </button>
            </span>
          )}
          {photo.buildSlug && (
            <Link href={`/builds/${photo.buildSlug}`} className="btn-go inline-flex h-12 items-center gap-2 rounded-sm px-5 text-sm font-bold">
              See the build <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function trapFocus(event: React.KeyboardEvent, container: HTMLElement | null) {
  if (!container) return;
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
  if (items.length === 0) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
