'use client';

import Image from 'next/image';
import { ImageIcon, X } from 'lucide-react';
import { useState } from 'react';
import { buttonClass, fieldClass } from '@/components/app/ui';

export interface MediaChoice {
  url: string;
  title: string;
}

/**
 * Picks a photo from the media library or one of the images the site ships with.
 * The stored value is always a URL; validation server-side restricts it to this
 * site or the storage bucket.
 */
export function MediaField({ name, initial, library }: { name: string; initial: string; library: readonly MediaChoice[] }) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-start gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-carbon">
          {value ? (
            <Image src={value} alt="" width={80} height={80} className="size-full object-cover" unoptimized />
          ) : (
            <ImageIcon className="size-6 text-steel" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-steel">{value || 'No photo chosen'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => setOpen((was) => !was)} className={buttonClass('secondary', 'sm')}>
              {open ? 'Close' : 'Choose photo'}
            </button>
            {value && (
              <button type="button" onClick={() => setValue('')} className={buttonClass('ghost', 'sm')}>
                <X className="size-3.5" aria-hidden="true" /> Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {open && (
        <div className="mt-3 rounded-md border border-line bg-carbon p-3">
          {library.length === 0 ? (
            <p className="text-sm text-steel">No photos yet. Add some in Media.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {library.map((item) => (
                <li key={item.url}>
                  <button
                    type="button"
                    onClick={() => { setValue(item.url); setOpen(false); }}
                    className={`block w-full overflow-hidden rounded border-2 ${item.url === value ? 'border-clover' : 'border-transparent hover:border-line'}`}
                    title={item.title}
                  >
                    <Image src={item.url} alt={item.title} width={160} height={160} className="aspect-square w-full object-cover" unoptimized />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="mt-3 block">
            <span className="text-xs text-steel">Or paste a link to a photo on this site</span>
            <input className={`${fieldClass} mt-1`} value={value} onChange={(event) => setValue(event.target.value)} placeholder="/images/shop-card.jpg" />
          </label>
        </div>
      )}
    </div>
  );
}
