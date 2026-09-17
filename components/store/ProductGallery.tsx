'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import type { StoreProduct } from '@/lib/store/normalize';
import { TILE } from './styles';

/** Swipeable scroll-snap gallery with thumbnails. Arrow keys scroll the focused track. */
export function ProductGallery({ images, title }: { images: StoreProduct['images']; title: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  if (!images.length) {
    return <div className={`grid aspect-square place-items-center bg-gunmetal text-steel ${TILE}`}>No photo</div>;
  }

  const show = (index: number) => {
    const node = track.current;
    if (!node) return;
    node.scrollTo({ left: index * node.clientWidth, behavior: 'smooth' });
    setActive(index);
  };

  return (
    <div>
      <div
        ref={track}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${title} photos`}
        onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className={`flex aspect-square snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-white [scrollbar-width:none] ${TILE}`}
      >
        {images.map((image, i) => (
          <div key={image.src} className="relative size-full shrink-0 snap-center" aria-roledescription="slide" aria-label={`${i + 1} of ${images.length}`}>
            <Image src={image.src} alt={image.alt} fill priority={i === 0} sizes="(min-width: 1024px) 600px, 100vw" className="object-contain p-4 sm:p-8" />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Choose photo">
          {images.map((image, i) => (
            <li key={image.src} className="shrink-0">
              <button
                type="button"
                onClick={() => show(i)}
                aria-label={`Photo ${i + 1}`}
                aria-current={active === i ? 'true' : undefined}
                className={`relative block size-16 overflow-hidden border-2 bg-white sm:size-20 ${TILE} [[data-design=v2]_&]:rounded-xl ${active === i ? 'border-clover' : 'border-transparent opacity-70 hover:opacity-100'}`}
              >
                <Image src={image.src} alt="" fill sizes="80px" className="object-contain p-1" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
