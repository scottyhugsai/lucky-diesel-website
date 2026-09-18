import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Pagination } from '@/components/store/Pagination';
import { ProductCard } from '@/components/store/ProductCard';
import { ProductFilters } from '@/components/store/ProductFilters';
import { StoreFallback } from '@/components/store/StoreFallback';
import { TruckBar } from '@/components/store/TruckBar';
import { countStocked, generationInfo, listingTruckFilter, paginate, parseStoreParams, productsHref, savedTruckLabel, sortProducts, stockedFirst } from '@/components/store/listing';
import { BTN_GHOST, BTN_PRIMARY, PILL, WRAP } from '@/components/store/styles';
import { readSavedTruck } from '@/lib/fitment/truck-server';
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
  const [{ products, ok }, content, truck] = await Promise.all([getStorefrontCatalog(), getSiteContent(), readSavedTruck()]);
  if (!ok) return <StoreFallback />;

  // A visitor who has already told us their truck should not land on everything.
  const fit = listingTruckFilter(params, truck);
  const lookup = (handle: string) => content.product(handle);
  const visible = applyOverrides(products, lookup);
  const matched = filterProducts(visible, { category: params.category, platform: fit.platform, generationCollection: fit.gen, query: params.q });
  const ordered = params.sort === 'featured' ? featuredFirst(sortProducts(matched, params.sort), lookup) : sortProducts(matched, params.sort);
  // Samples outnumber the real catalogue two to one; they queue behind it, and
  // can be dropped entirely, but nothing here ever reorders them into it.
  const split = countStocked(ordered);
  const results = stockedFirst(params.stocked ? ordered.filter((p) => p.source !== 'demo') : ordered);
  const slice = paginate(results, params.page);
  const examplesOnPage = slice.items.filter((p) => p.source === 'demo');
  const stockedOnPage = slice.items.filter((p) => p.source !== 'demo');

  const category = CATEGORIES.find((c) => c.id === params.category);
  const heading = fit.fromSavedTruck
    ? savedTruckLabel(truck)
    : generationInfo(params.gen)?.name ?? PLATFORMS.find((p) => p.id === params.platform)?.name;
  // Every filter link restarts the listing: page 7 of turbos is not page 7 of fuel.
  const refine = (over: Partial<typeof params>) => productsHref({ ...params, page: 1, ...over });
  const chip = (isOn: boolean) => `inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border px-4 text-sm font-semibold transition-colors ${PILL} ${isOn ? 'border-clover bg-clover text-carbon' : 'border-line hover:border-clover'}`;
  const grid = 'grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4';

  return (
    <div className={`${WRAP} pb-28 pt-28 sm:pt-36 lg:pb-20`}>
      <nav aria-label="Breadcrumb" className="text-sm text-steel">
        <Link href="/store" className="hover:text-clover">Store</Link> <span aria-hidden="true">/</span> <span className="text-chalk/80">Parts</span>
      </nav>
      <h1 className="display mt-4 text-4xl sm:text-6xl">{category?.name ?? 'All parts'}{heading && <span className="text-clover"> · {heading}</span>}</h1>

      <div className="mt-5"><TruckBar truck={truck} returnTo={productsHref(params)} params={params} filter={fit} /></div>

      <div className="mt-6"><ProductFilters params={params} resultCount={results.length} /></div>

      <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2 pb-1" aria-label="Categories">
          <li><Link href={refine({ category: null })} aria-current={!params.category ? 'true' : undefined} className={chip(!params.category)}>All</Link></li>
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <Link href={refine({ category: c.id })} aria-current={params.category === c.id ? 'true' : undefined} className={chip(params.category === c.id)}>{c.short}</Link>
            </li>
          ))}
        </ul>
      </div>

      {/* The count says what is actually for sale. Sample listings are the bulk of
          the catalogue, so folding them into one number would overstate the shop. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="text-sm text-steel tabular-nums" aria-live="polite">
          <span className="font-semibold text-chalk">{split.stocked}</span> {split.stocked === 1 ? 'part' : 'parts'} in stock
          {split.examples > 0 && <> · <span className="text-chalk/70">{split.examples} examples</span></>}
          {slice.pages > 1 && <span className="text-chalk/70"> · page {slice.page} of {slice.pages}</span>}
        </p>
        {split.examples > 0 && (
          <Link
            href={refine({ stocked: !params.stocked })}
            className={`inline-flex min-h-11 items-center gap-2 border px-4 text-sm font-semibold transition-colors ${PILL} ${params.stocked ? 'border-clover text-clover' : 'border-line hover:border-clover'}`}
          >
            <span aria-hidden="true" className={`grid size-4 place-items-center border ${params.stocked ? 'border-clover bg-clover text-carbon' : 'border-steel'}`}>
              {params.stocked && <Check className="size-3" strokeWidth={3} />}
            </span>
            In stock only
          </Link>
        )}
      </div>

      {/* The grid is a plain GET form: ticking parts and pressing Compare works
          with JavaScript off, and the result is a shareable URL. */}
      {slice.items.length ? (
        <form method="get" action="/store/compare">
          {stockedOnPage.length > 0 && (
            <ul className={`mt-4 ${grid}`}>
              {stockedOnPage.map((product, i) => (
                <li key={product.handle}><ProductCard product={product} priority={slice.page === 1 && i < 4} compare truck={truck} /></li>
              ))}
            </ul>
          )}

          {examplesOnPage.length > 0 && (
            <section aria-labelledby="examples-heading" className="mt-10 border-t border-line pt-8">
              <h2 id="examples-heading" className="display text-3xl not-italic [[data-design=v2]_&]:text-2xl">Examples, not stock</h2>
              <p className="mt-2 max-w-prose text-sm text-steel">
                Listings for trucks the shop does not stock yet. Nothing below is for sale — we quote it.
              </p>
              <ul className={`mt-5 ${grid}`}>
                {examplesOnPage.map((product) => (
                  <li key={product.handle}><ProductCard product={product} compare dense truck={truck} /></li>
                ))}
              </ul>
            </section>
          )}

          {slice.items.length > 1 && (
            <div className="sticky bottom-20 z-30 mt-6 flex justify-center lg:bottom-6">
              <button type="submit" className={`${BTN_PRIMARY} shadow-2xl`}>
                Compare selected <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </form>
      ) : (
        <div className="mt-6 border border-dashed border-line p-8 text-center [[data-design=v2]_&]:rounded-3xl">
          <p className="display text-3xl not-italic [[data-design=v2]_&]:text-2xl">No parts match that.</p>
          <p className="mt-2 text-chalk/70">Try fewer filters, or call <span className="whitespace-nowrap">{BUSINESS.phoneDisplay}</span> and we’ll find it.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={fit.fromSavedTruck ? '/store/products?all=1' : '/store/products'} className={BTN_GHOST}>
              {fit.fromSavedTruck ? 'Show every part' : 'Clear filters'}
            </Link>
            <a href={BUSINESS.phoneHref} className={BTN_GHOST}>Call the shop</a>
          </div>
        </div>
      )}

      <Pagination params={params} slice={slice} />
    </div>
  );
}
