import Image from 'next/image';
import Link from 'next/link';
import { money } from '@/lib/format';
import type { BlockValues } from '@/lib/site-content/fields';
import { str } from '@/lib/site-content/values';
import { getCatalog } from '@/lib/store/catalog';
import type { StoreProduct } from '@/lib/store/normalize';
import { safeToPromote } from '@/lib/store/promotable';
import { SECTION, SectionHead, WRAP } from '../ui';

const COUNT = 6;

/** One product per category in rotation, so the row shows breadth. Real,
 *  buyable parts only — getCatalog never carries a sample listing, and
 *  anything that trips the claims checker is out. */
function pick(products: readonly StoreProduct[]): StoreProduct[] {
  const buckets = new Map<string, StoreProduct[]>();
  for (const product of products.filter((p) => p.available && p.images.length > 0 && p.category !== 'merch')) {
    buckets.set(product.category, [...(buckets.get(product.category) ?? []), product]);
  }
  const pools = [...buckets.values()];
  const picked: StoreProduct[] = [];
  for (let round = 0; picked.length < COUNT && pools.some((pool) => pool[round]); round += 1) {
    for (const pool of pools) {
      const next = pool[round];
      if (next && picked.length < COUNT) picked.push(next);
    }
  }
  return picked;
}

export async function PartsV4({ values, step }: { values: BlockValues; step: string }) {
  const catalog = await getCatalog();
  const products = catalog.ok ? pick(safeToPromote(catalog.products)) : [];
  if (!products.length) return null;

  return (
    <section id="parts" aria-labelledby="parts-v4-heading" className={`${SECTION} border-t border-line`}>
      <div className={WRAP}>
        <SectionHead
          id="parts-v4-heading"
          index={`${step} — Parts`}
          title={str(values, 'heading').split('\n').filter(Boolean).join(' ')}
          line={str(values, 'intro')}
          href="/store"
          linkLabel="Store"
        />
        <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
          {products.map((product) => (
            <li key={product.handle} className="v4-tier group relative overflow-hidden">
              <div className="relative aspect-square bg-white">
                <Image
                  src={product.images[0]?.src ?? ''}
                  alt={product.images[0]?.alt ?? ''}
                  fill
                  sizes="(min-width: 768px) 320px, 45vw"
                  className="object-contain p-4 transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </div>
              <div className="border-t border-line p-4">
                <p className="kicker truncate">{product.vendor}</p>
                <h3 data-copy="data" className="mt-1.5 line-clamp-2 text-[0.9375rem] font-semibold leading-snug">
                  <Link href={`/store/products/${product.handle}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                    {product.title}
                  </Link>
                </h3>
                <p className="v4-num mt-2 text-[0.9375rem] font-semibold text-clover">{money(product.priceMinCents)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
