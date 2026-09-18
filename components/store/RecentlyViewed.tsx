import Link from 'next/link';
import Image from 'next/image';
import type { StoreProduct } from '@/lib/store/normalize';
import { priceLabel } from './listing';
import { TILE } from './styles';

/** Parts this visitor already opened, in the order they opened them. */
export function RecentlyViewed({ products }: { products: readonly StoreProduct[] }) {
  if (products.length === 0) return null;

  return (
    /* A trail holds anywhere from one part to six, so the tiles keep a fixed
       width and the row scrolls. A grid would leave dead columns at the sizes
       where the visitor has only opened one or two things. */
    <ul className="-mx-4 mt-8 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-3 sm:gap-3 md:mx-0 md:px-0">
      {products.map((product) => (
        <li key={product.handle} className="w-40 shrink-0 snap-start sm:w-48">
          <Link
            href={`/store/products/${product.handle}`}
            className={`group flex h-full flex-col overflow-hidden border border-line bg-carbon-2 transition-colors hover:border-clover ${TILE} [[data-design=v2]_&]:border-transparent`}
          >
            <span className="relative block aspect-square bg-white">
              {product.images[0] ? (
                <Image src={product.images[0].src} alt="" fill sizes="192px" className="object-contain p-3" />
              ) : (
                <span className="grid h-full place-items-center px-2 text-center text-xs text-steel">No photo</span>
              )}
            </span>
            <span className="flex flex-1 flex-col gap-1 p-3">
              <span data-copy="data" className="line-clamp-2 text-sm font-semibold leading-snug">{product.title}</span>
              <span className="mt-auto pt-1 text-sm font-bold tabular-nums">{priceLabel(product)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
