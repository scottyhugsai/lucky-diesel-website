import Image from 'next/image';
import Link from 'next/link';
import type { StoreProduct } from '@/lib/store/normalize';
import { Badge, FitBadge } from './FitBadge';
import { priceLabel } from './listing';
import { TILE } from './styles';

/** Grid card. Server-rendered; only the fitment badge reads the saved truck on the client. */
export function ProductCard({ product, priority = false }: { product: StoreProduct; priority?: boolean }) {
  const image = product.images[0];
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
        {product.source === 'demo' && (
          <span className="absolute left-2 top-2 bg-amber-300 px-2 py-1 text-xs font-bold uppercase tracking-wide text-carbon [[data-design=v2]_&]:rounded-full [[data-design=v2]_&]:normal-case">Sample</span>
        )}
        {!product.available && product.purchasable && (
          <span className="absolute left-2 top-2 bg-carbon px-2 py-1 text-xs font-bold uppercase tracking-wide text-chalk [[data-design=v2]_&]:rounded-full [[data-design=v2]_&]:normal-case">Sold out</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel [[data-design=v2]_&]:normal-case [[data-design=v2]_&]:tracking-normal">{product.vendor}</p>
        <h3 className="line-clamp-3 text-sm font-semibold leading-snug sm:text-base">
          <Link href={`/store/products/${product.handle}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {product.title}
          </Link>
        </h3>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          <FitBadge product={product} />
          {product.offRoadOnly && <Badge tone="warn">Off-road use only</Badge>}
        </div>
        <p className="font-bold tabular-nums text-chalk">{priceLabel(product)}</p>
      </div>
    </article>
  );
}
