import Link from 'next/link';
import Image from 'next/image';
import type { StoreProduct } from '@/lib/store/normalize';
import { priceLabel } from './listing';
import { TILE } from './styles';

/** Parts this visitor already opened, in the order they opened them. */
export function RecentlyViewed({ products }: { products: readonly StoreProduct[] }) {
  if (products.length === 0) return null;

  return (
    <ul className="mt-8 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
      {products.map((product) => (
        <li key={product.handle}>
          <Link
            href={`/store/products/${product.handle}`}
            className={`group flex h-full flex-col overflow-hidden border border-line bg-carbon-2 transition-colors hover:border-clover ${TILE} [[data-design=v2]_&]:border-transparent`}
          >
            <span className="relative block aspect-square bg-white">
              {product.images[0] ? (
                <Image src={product.images[0].src} alt="" fill sizes="(min-width: 1280px) 200px, 33vw" className="object-contain p-3" />
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
