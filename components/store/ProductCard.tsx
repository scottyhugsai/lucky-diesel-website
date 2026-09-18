import Image from 'next/image';
import Link from 'next/link';
import type { SavedTruck } from '@/lib/fitment/truck-cookie';
import type { StoreProduct } from '@/lib/store/normalize';
import { Badge, FitBadge } from './FitBadge';
import { priceLabel } from './listing';
import { TILE } from './styles';

interface ProductCardProps {
  product: StoreProduct;
  priority?: boolean;
  compare?: boolean;
  /** The visitor's truck, read from the cookie by the page, so fitment is on the card at once. */
  truck?: SavedTruck | null;
  /** Drops the image well. For listings that have no photo, where an empty square only advertises the gap. */
  dense?: boolean;
}

/** Grid card. Entirely server-rendered, fitment verdict included. */
export function ProductCard({ product, priority = false, compare = false, truck = null, dense = false }: ProductCardProps) {
  const image = product.images[0];
  if (dense && !image) return <DenseCard product={product} compare={compare} truck={truck} />;
  return (
    <article className={`group relative flex has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-clover h-full flex-col overflow-hidden border border-line bg-carbon-2 transition-colors hover:border-clover/60 ${TILE} [[data-design=v2]_&]:border-transparent [[data-design=v2]_&]:hover:border-transparent [[data-design=v2]_&]:hover:bg-gunmetal`}>
      <div className="relative aspect-square bg-white [[data-design=v2]_&]:m-2 [[data-design=v2]_&]:rounded-2xl [[data-design=v2]_&]:overflow-hidden">
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw"
            className={`object-contain p-3 transition-transform duration-500 group-hover:scale-[1.04] ${product.available ? '' : 'opacity-50 grayscale'}`}
          />
        ) : (
          <div className="grid h-full place-items-center bg-gunmetal px-3 text-center text-sm text-steel">
            {product.source === 'demo' ? 'Sample listing — no photo yet' : 'No photo'}
          </div>
        )}
        {compare && (
          <label className="absolute bottom-2 right-2 z-10 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm border border-line bg-carbon/90 px-2.5 text-xs font-semibold backdrop-blur transition-colors hover:border-clover">
            <input type="checkbox" name="c" value={product.handle} className="size-4 accent-clover" />
            <span>Compare</span>
            <span className="sr-only">{product.title}</span>
          </label>
        )}
        {product.source === 'demo' && (
          <span className="absolute left-2 top-2 border border-line bg-carbon/90 px-2 py-1 text-xs font-bold uppercase tracking-wide text-steel backdrop-blur [[data-design=v2]_&]:rounded-full [[data-design=v2]_&]:normal-case">Sample</span>
        )}
        {!product.available && product.purchasable && (
          <span className="absolute left-2 top-2 bg-carbon px-2 py-1 text-xs font-bold uppercase tracking-wide text-chalk [[data-design=v2]_&]:rounded-full [[data-design=v2]_&]:normal-case">Sold out</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel [[data-design=v2]_&]:normal-case [[data-design=v2]_&]:tracking-normal">{product.vendor}</p>
        <h3 data-copy="data" className="line-clamp-3 text-sm font-semibold leading-snug sm:text-base">
          <Link href={`/store/products/${product.handle}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {product.title}
          </Link>
        </h3>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          <FitBadge product={product} truck={truck} />
          {product.offRoadOnly && <Badge tone="warn">Off-road use only</Badge>}
        </div>
        <p className="font-bold tabular-nums text-chalk">{priceLabel(product)}</p>
      </div>
    </article>
  );
}

const COMPARE = 'flex min-h-11 cursor-pointer items-center gap-1.5 text-xs font-semibold text-steel transition-colors hover:text-clover';

/**
 * A listing with no photograph, at text weight. The full card gives a square of
 * grey the same size as a real product's photo, so a page of them reads as a
 * catalogue of missing images rather than a list of parts we can quote.
 */
function DenseCard({ product, compare, truck }: { product: StoreProduct; compare: boolean; truck: SavedTruck | null }) {
  return (
    <article className={`group relative flex h-full flex-col gap-2 border border-line bg-carbon-2 p-3 transition-colors has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-clover hover:border-clover/60 sm:p-4 ${TILE} [[data-design=v2]_&]:border-transparent [[data-design=v2]_&]:hover:border-transparent [[data-design=v2]_&]:hover:bg-gunmetal`}>
      <div className="flex items-center gap-2">
        <span className="border border-line px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-steel [[data-design=v2]_&]:rounded-full [[data-design=v2]_&]:normal-case">Sample</span>
        {/* The sample catalogue's own "vendor" is the word the badge already says. */}
        {!/^sample/i.test(product.vendor) && (
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-steel [[data-design=v2]_&]:normal-case [[data-design=v2]_&]:tracking-normal">{product.vendor}</p>
        )}
      </div>
      <h3 data-copy="data" className="line-clamp-3 text-sm font-semibold leading-snug sm:text-base">
        <Link href={`/store/products/${product.handle}`} className="after:absolute after:inset-0 focus-visible:outline-none">
          {product.title}
        </Link>
      </h3>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        <FitBadge product={product} truck={truck} />
        {product.offRoadOnly && <Badge tone="warn">Off-road use only</Badge>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-chalk">{priceLabel(product)}</p>
        {compare && (
          <label className={`relative z-10 ${COMPARE}`}>
            <input type="checkbox" name="c" value={product.handle} className="size-4 accent-clover" />
            <span>Compare</span>
            <span className="sr-only">{product.title}</span>
          </label>
        )}
      </div>
    </article>
  );
}
