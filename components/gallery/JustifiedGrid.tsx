import Image from 'next/image';
import { altText, type GalleryPhoto } from './constants';
import { TileButton } from './LightboxProvider';

/** Target row heights (px) per breakpoint; mirrored in the `--row-h` classes below. */
const ROW_H = { base: 110, sm: 220, lg: 300 } as const;
/** Tiles may stretch to fill a row, so request somewhat more than the target width. */
const STRETCH = 1.6;
const EAGER_COUNT = 4;

function sizesFor(ratio: number): string {
  const px = (rowHeight: number) => `${Math.round(Math.min(ratio * rowHeight * STRETCH, 1400))}px`;
  return `(min-width: 1024px) ${px(ROW_H.lg)}, (min-width: 640px) ${px(ROW_H.sm)}, ${ratio >= 1.2 ? '70vw' : '50vw'}`;
}

/**
 * Justified rows (Flickr-style) in pure CSS: each tile's flex-grow and flex-basis
 * are proportional to its aspect ratio, so rows fill the width, photos are never
 * cropped, and the stored width/height reserve space before the image loads.
 */
export function JustifiedGrid({ photos }: { photos: GalleryPhoto[] }) {
  return (
    <ul className="flex flex-wrap gap-1 [--row-h:110px] after:grow-[999999] after:content-[''] sm:gap-1.5 sm:[--row-h:220px] lg:[--row-h:300px] [[data-design=v2]_&]:gap-3 sm:[[data-design=v2]_&]:gap-4">
      {photos.map((photo, index) => {
        const ratio = photo.width / photo.height;
        return (
          <li key={photo.id} className="group relative min-w-0" style={{ flexGrow: ratio * 100, flexBasis: `calc(var(--row-h) * ${ratio.toFixed(4)})` }}>
            <TileButton
              index={index}
              label={`Open photo: ${photo.title}`}
              className="relative block w-full overflow-hidden rounded-sm bg-carbon-2 text-left [[data-design=v2]_&]:rounded-2xl sm:[[data-design=v2]_&]:rounded-3xl"
            >
              <span className="block" style={{ paddingBottom: `${(100 / ratio).toFixed(3)}%` }} aria-hidden="true" />
              <Image
                src={photo.src}
                alt={altText(photo)}
                fill
                sizes={sizesFor(ratio)}
                loading={index < EAGER_COUNT ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : undefined}
                className="object-cover transition-[transform,filter] duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              {photo.isSample && (
                <span className="absolute left-2 top-2 rounded-sm bg-carbon/80 px-1.5 py-0.5 text-[0.7rem] font-semibold text-chalk/75 backdrop-blur [[data-design=v2]_&]:rounded-full [[data-design=v2]_&]:px-2.5">
                  Example
                </span>
              )}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 hidden translate-y-2 bg-gradient-to-t from-carbon/90 via-carbon/50 to-transparent p-4 pt-12 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none sm:block">
                <span className="display block text-2xl text-chalk">{photo.title}</span>
                {(photo.vehicleLabel || photo.caption) && (
                  <span className="mt-1 line-clamp-2 block text-sm text-chalk/75">{photo.vehicleLabel ?? photo.caption}</span>
                )}
              </span>
            </TileButton>
            <p className="truncate px-0.5 pb-2 pt-1.5 text-xs font-semibold text-chalk/70 sm:hidden">{photo.title}</p>
          </li>
        );
      })}
    </ul>
  );
}
