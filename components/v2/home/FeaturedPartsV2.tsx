import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/ui/Reveal';
import { money } from '@/lib/format';
import type { BlockValues } from '@/lib/site-content/fields';
import { str } from '@/lib/site-content/values';
import { BUSINESS } from '@/lib/site';
import { getCatalog } from '@/lib/store/catalog';
import { safeToPromote } from '@/lib/store/promotable';
import type { StoreProduct } from '@/lib/store/normalize';
import { Band, TextLink } from '../ui';

const FEATURED_COUNT = 10;

/** One product per category in rotation, so the row shows the breadth of the store rather than ten turbos. */
function pickFeatured(products: readonly StoreProduct[]): StoreProduct[] {
  const eligible = products.filter((product) => product.available && product.images.length > 0);
  const byCategory = new Map<string, StoreProduct[]>();
  for (const product of eligible) {
    byCategory.set(product.category, [...(byCategory.get(product.category) ?? []), product]);
  }
  const buckets = [...byCategory.values()].filter((bucket) => bucket.length > 0);
  const picked: StoreProduct[] = [];
  for (let round = 0; picked.length < FEATURED_COUNT && buckets.some((bucket) => bucket[round]); round += 1) {
    for (const bucket of buckets) {
      const product = bucket[round];
      if (product && picked.length < FEATURED_COUNT) picked.push(product);
    }
  }
  return picked;
}

export async function FeaturedPartsV2({ values }: { values: BlockValues }) {
  const catalog = await getCatalog();
  // A homepage row is a promotion: off-road-only parts and anything whose
  // listing trips the claims checker stay out of it.
  const products = catalog.ok ? pickFeatured(safeToPromote(catalog.products)) : [];

  return (
    <Band id="parts" tone="carbon-2" labelledBy="parts-heading">
      <div className="mx-auto max-w-[1024px] px-4 sm:px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="parts-heading" className="v2-title text-[clamp(2.25rem,1.4rem+3.4vw,4rem)]">{str(values, 'heading')}</h2>
            <p className="mt-3 text-[19px] text-chalk/70 sm:text-[22px]">{str(values, 'intro')}</p>
          </div>
          <TextLink href="/store">All products</TextLink>
        </Reveal>
      </div>

      {products.length > 0 ? (
        <ul className="v2-scroll v2-row mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:mt-12 sm:gap-5">
          {products.map((product) => {
            const image = product.images[0]!;
            return (
              <li key={product.id} className="w-[272px] shrink-0 snap-start sm:w-[300px]">
                <Link href={`/store/products/${product.handle}`} className="v2-tile group flex h-full flex-col rounded-[24px] bg-chalk p-5 text-carbon">
                  <div className="relative aspect-square overflow-hidden rounded-[16px] bg-white">
                    <Image
                      src={image.src}
                      alt={image.alt || product.title}
                      fill
                      sizes="300px"
                      className="object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
                    />
                  </div>
                  <h3 data-copy="data" className="mt-5 line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight">{product.title}</h3>
                  <p className="mt-1 text-[15px] text-carbon/60">From {money(product.priceMinCents, { whole: true })}</p>
                  <p className="mt-auto pt-4 text-[15px] font-medium text-carbon">
                    Buy <span aria-hidden="true" className="text-clover-deep">›</span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mx-auto mt-10 max-w-[1024px] px-4 text-[17px] text-chalk/70 sm:px-6">
          The store is catching its breath.{' '}
          <a href={BUSINESS.store} target="_blank" rel="noopener noreferrer" className="text-clover hover:underline">Shop on luckydiesel.com ›</a>
        </p>
      )}
    </Band>
  );
}
