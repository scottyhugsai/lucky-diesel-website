import Image from 'next/image';
import Link from 'next/link';
import { featuredProducts } from '@/components/store/listing';
import { money } from '@/lib/format';
import { BUSINESS } from '@/lib/site';
import { getCatalog } from '@/lib/store/catalog';
import { BTN_GHOST, MONO, SECTION, SectionHead, WRAP } from '../ui';

const LIMIT = 4;

/** Four live parts from the Shopify catalog. If Shopify is unreachable, one honest card points at the store. */
export async function FeaturedPartsV3() {
  const { products, ok } = await getCatalog();
  const featured = ok ? featuredProducts(products, ['turbo', 'fuel', 'tuning'], LIMIT) : [];

  return (
    <section aria-labelledby="parts-heading" className={`${SECTION} border-t border-line`}>
      <div className={WRAP}>
        <SectionHead id="parts-heading" index="04 / PARTS" title="Parts we run" line="Shipped fast, or installed here." href="/store" linkLabel="Store" />
        {featured.length ? (
          <ul className="mt-8 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {featured.map((product) => {
              const image = product.images[0];
              const hasRange = product.priceMaxCents > product.priceMinCents;
              return (
                <li key={product.handle}>
                  <Link href={`/store/products/${product.handle}`} className="v3-tile flex h-full flex-col rounded-[8px] border border-line bg-carbon-2 p-2.5 hover:border-clover">
                    <div className="relative aspect-square overflow-hidden rounded-[6px] bg-chalk">
                      {image && <Image src={image.src} alt={image.alt} fill sizes="(min-width: 1024px) 280px, 45vw" className="object-contain p-2" />}
                    </div>
                    <p className="mt-3 text-[0.6875rem] uppercase tracking-[0.12em] text-steel">{product.vendor}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-chalk">{product.title}</p>
                    <p className={`${MONO} mt-auto pt-3 text-sm text-clover`}>{hasRange && <span className="text-steel">from </span>}{money(product.priceMinCents)}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-8 rounded-[8px] border border-line bg-carbon-2 p-6">
            <p className="text-[0.9375rem] text-chalk/80">The live catalog is not answering right now. The store is still open.</p>
            <a href={BUSINESS.store} target="_blank" rel="noopener noreferrer" className={`${BTN_GHOST} mt-4`}>Open store</a>
          </div>
        )}
      </div>
    </section>
  );
}
