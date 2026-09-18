import type { Metadata } from 'next';
import Link from 'next/link';
import { MyTruckChip } from '@/components/store/MyTruckChip';
import { ProductCard } from '@/components/store/ProductCard';
import { ProductFilters } from '@/components/store/ProductFilters';
import { StoreFallback } from '@/components/store/StoreFallback';
import { generationInfo, parseStoreParams, productsHref, sortProducts } from '@/components/store/listing';
import { BTN_GHOST, PILL, WRAP } from '@/components/store/styles';
import { BUSINESS, PLATFORMS } from '@/lib/site';
import { filterProducts, getStorefrontCatalog } from '@/lib/store/catalog';
import { applyOverrides, featuredFirst } from '@/lib/store/overrides';
import { getSiteContent } from '@/lib/site-content/read';
import { CATEGORIES } from '@/lib/store/normalize';

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: `Shop Diesel Parts | ${BUSINESS.name}`,
  description: 'Turbos, fuel systems, tuning and exhaust for Duramax, Powerstroke and Cummins trucks.',
  alternates: { canonical: '/store/products' },
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = parseStoreParams(await searchParams);
  const [{ products, ok }, content] = await Promise.all([getStorefrontCatalog(), getSiteContent()]);
  if (!ok) return <StoreFallback />;

  const lookup = (handle: string) => content.product(handle);
  const visible = applyOverrides(products, lookup);
  const matched = filterProducts(visible, { category: params.category, platform: params.platform, generationCollection: params.gen, query: params.q });
  const results = params.sort === 'featured' ? featuredFirst(sortProducts(matched, params.sort), lookup) : sortProducts(matched, params.sort);
  const category = CATEGORIES.find((c) => c.id === params.category);
  const heading = generationInfo(params.gen)?.name ?? PLATFORMS.find((p) => p.id === params.platform)?.name;
  const chip = (isOn: boolean) => `inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border px-4 text-sm font-semibold transition-colors ${PILL} ${isOn ? 'border-clover bg-clover text-carbon' : 'border-line hover:border-clover'}`;

  return (
    <div className={`${WRAP} pb-28 pt-28 sm:pt-36 lg:pb-20`}>
      <nav aria-label="Breadcrumb" className="text-sm text-steel">
        <Link href="/store" className="hover:text-clover">Store</Link> <span aria-hidden="true">/</span> <span className="text-chalk/80">Parts</span>
      </nav>
      <h1 className="display mt-4 text-4xl sm:text-6xl">{category?.name ?? 'All parts'}{heading && <span className="text-clover"> · {heading}</span>}</h1>

      <div className="mt-6"><ProductFilters params={params} resultCount={results.length} /></div>

      <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2 pb-1" aria-label="Categories">
          <li><MyTruckChip params={params} /></li>
          <li><Link href={productsHref({ ...params, category: null })} aria-current={!params.category ? 'true' : undefined} className={chip(!params.category)}>All</Link></li>
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <Link href={productsHref({ ...params, category: c.id })} aria-current={params.category === c.id ? 'true' : undefined} className={chip(params.category === c.id)}>{c.short}</Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-sm text-steel tabular-nums" aria-live="polite">{results.length} {results.length === 1 ? 'part' : 'parts'}</p>

      {results.length ? (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
          {results.map((product, i) => <li key={product.handle}><ProductCard product={product} priority={i < 4} /></li>)}
        </ul>
      ) : (
        <div className="mt-6 border border-dashed border-line p-8 text-center [[data-design=v2]_&]:rounded-3xl">
          <p className="display text-3xl not-italic [[data-design=v2]_&]:text-2xl">No parts match that.</p>
          <p className="mt-2 text-chalk/70">Try fewer filters, or call <span className="whitespace-nowrap">{BUSINESS.phoneDisplay}</span> and we’ll find it.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/store/products" className={BTN_GHOST}>Clear filters</Link>
            <a href={BUSINESS.phoneHref} className={BTN_GHOST}>Call the shop</a>
          </div>
        </div>
      )}
    </div>
  );
}
