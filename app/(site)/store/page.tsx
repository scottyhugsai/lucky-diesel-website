import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { ProductCard } from '@/components/store/ProductCard';
import { RecentlyViewed } from '@/components/store/RecentlyViewed';
import { ShopByTruck } from '@/components/store/ShopByTruck';
import { StoreFallback } from '@/components/store/StoreFallback';
import { TruckBar } from '@/components/store/TruckBar';
import { featuredProducts, productsHref, savedTruckLabel } from '@/components/store/listing';
import { BTN_GHOST, BTN_PRIMARY, TILE, WRAP } from '@/components/store/styles';
import { readRecent } from '@/components/store/recent-server';
import { recentProducts } from '@/components/store/recent';
import { readSavedTruck } from '@/lib/fitment/truck-server';
import { getStorefrontCatalog } from '@/lib/store/catalog';
import { applyOverrides, featuredFirst } from '@/lib/store/overrides';
import { safeToPromote } from '@/lib/store/promotable';
import { CATEGORIES } from '@/lib/store/normalize';
import { seoMetadata } from '@/lib/site-content/metadata';
import { getSiteContent } from '@/lib/site-content/read';
import { str } from '@/lib/site-content/values';

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('store', '/store');
}

export default async function StorePage() {
  const [{ products, ok }, content, truck, seen] = await Promise.all([getStorefrontCatalog(), getSiteContent(), readSavedTruck(), readRecent()]);
  if (!ok) return <StoreFallback />;
  const truckName = savedTruckLabel(truck);
  const copy = content.block('page.store');
  const lookup = (handle: string) => content.product(handle);
  const visible = applyOverrides(products, lookup);
  // Not filtered through safeToPromote: this is not the shop putting a part
  // forward, it is the visitor's own trail back to what they were reading.
  const recent = recentProducts(visible, seen);

  // A category tile states a count and shows a cover image, which is the shop
  // advertising its own catalogue — so it follows the same rule the featured
  // row below already follows. Counting every visible row inflated these with
  // sample listings, and the cover was picked from them too: the accessories
  // tile was a truck in a cloud of smoke, on a page whose own ticker says
  // emissions equipment stays intact.
  const promotable = safeToPromote(visible);
  const categories = CATEGORIES.map((category) => {
    const members = promotable.filter((p) => p.category === category.id);
    const cover = members.find((p) => p.available && p.images.length) ?? members.find((p) => p.images.length);
    return { ...category, count: members.length, image: cover?.images[0] ?? null };
  }).filter((c) => c.count > 0);
  // The featured row promotes specific SKUs, so it follows the promotion rule.
  const featured = featuredFirst(featuredProducts(promotable, ['turbo', 'fuel', 'tuning'], 8), lookup);

  return (
    <>
      <section aria-labelledby="store-heading" className="grain relative isolate overflow-hidden pb-12 pt-28 sm:pb-16 sm:pt-40">
        <div aria-hidden="true" className="absolute -right-40 -top-20 -z-10 size-[36rem] rounded-full opacity-40 blur-3xl" style={{ background: 'radial-gradient(circle, var(--clover-glow), transparent 65%)' }} />
        <div className={WRAP}>
          <p className="kicker">{str(copy, 'kicker')}</p>
          <h1 id="store-heading" className="display rise mt-4 text-[length:var(--text-display)]">{str(copy, 'heading')}</h1>
          <p className="mt-5 max-w-lg text-lg text-chalk/75">{str(copy, 'intro')}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/store/products" className={BTN_PRIMARY}>
              {truckName ? `Parts for your ${truckName}` : 'Shop all parts'} <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
            <Link href="/build-planner" className={BTN_GHOST}>Plan a build</Link>
          </div>
          <div className="mt-6 max-w-xl"><TruckBar truck={truck} returnTo="/store" /></div>
        </div>
      </section>

      <section aria-labelledby="truck-heading" className="border-t border-line py-14 sm:py-20 [[data-design=v2]_&]:border-transparent">
        <div className={WRAP}>
          <h2 id="truck-heading" className="display text-4xl sm:text-5xl">Shop by truck</h2>
          <p className="mt-2 text-chalk/65">We’ll remember it and flag what fits.</p>
          <div className="mt-8"><ShopByTruck /></div>
        </div>
      </section>

      <section aria-labelledby="cat-heading" className="bg-carbon-2 py-14 sm:py-20 [[data-design=v2]_&]:bg-carbon">
        <div className={WRAP}>
          <h2 id="cat-heading" className="display text-4xl sm:text-5xl">Shop by category</h2>
          <ul className="mt-8 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
            {categories.map((category) => (
              <li key={category.id}>
                <Link href={productsHref({ category: category.id })} className={`group flex h-full flex-col overflow-hidden border border-line bg-carbon transition-colors hover:border-clover ${TILE} [[data-design=v2]_&]:border-transparent [[data-design=v2]_&]:bg-carbon-2`}>
                  <span className="relative block aspect-[4/3] bg-white [[data-design=v2]_&]:m-2 [[data-design=v2]_&]:overflow-hidden [[data-design=v2]_&]:rounded-2xl">
                    {category.image && (
                      <Image src={category.image.src} alt="" fill sizes="(min-width: 1024px) 400px, 50vw" className="object-contain p-4 transition-transform duration-500 group-hover:scale-105" />
                    )}
                  </span>
                  <span className="flex items-end justify-between gap-2 p-3 sm:p-5">
                    <span>
                      <span className="display block text-2xl not-italic sm:text-4xl [[data-design=v2]_&]:text-lg sm:[[data-design=v2]_&]:text-2xl">{category.name}</span>
                      <span className="mt-1 block text-sm text-steel tabular-nums">{category.count} {category.count === 1 ? 'product' : 'products'}</span>
                    </span>
                    <ArrowRight className="mb-1 hidden size-5 shrink-0 text-clover transition-transform group-hover:translate-x-1 sm:block" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {featured.length > 0 && (
        <section aria-labelledby="featured-heading" className="py-14 sm:py-20">
          <div className={WRAP}>
            <div className="flex items-end justify-between gap-4">
              <h2 id="featured-heading" className="display text-4xl sm:text-5xl">Shop favorites</h2>
              <Link href="/store/products" className="flex min-h-11 items-center gap-1 font-semibold text-clover">See all <ArrowRight className="size-4" aria-hidden="true" /></Link>
            </div>
            <ul className="mt-8 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
              {featured.map((product) => <li key={product.handle}><ProductCard product={product} truck={truck} /></li>)}
            </ul>
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="border-t border-line py-14 sm:py-20 [[data-design=v2]_&]:border-transparent">
          <div className={WRAP}>
            <h2 id="recent-heading" className="display text-4xl sm:text-5xl">Recently viewed</h2>
            <p className="mt-2 text-chalk/65">The parts you opened last, on this browser.</p>
            <RecentlyViewed products={recent} />
          </div>
        </section>
      )}

      <section aria-label="Help choosing parts" className="pb-28 lg:pb-20">
        <div className={`${WRAP} grid gap-3 md:grid-cols-2`}>
          <Link href="/build-planner" className={`group flex min-h-40 flex-col justify-between gap-6 bg-clover p-6 text-carbon sm:p-8 ${TILE}`}>
            <span className="display text-3xl not-italic sm:text-4xl">Not sure what fits?</span>
            <span className="flex items-center gap-2 font-semibold">Use the Build planner <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
          </Link>
          <div className={`flex flex-col justify-between gap-4 border border-line bg-carbon-2 p-6 sm:p-8 ${TILE} [[data-design=v2]_&]:border-transparent`}>
            <p className="flex items-start gap-3 text-chalk/80">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden="true" />
              Some parts are sold for off-road and competition use only.
            </p>
            <Link href="/emissions-policy" className="flex min-h-11 items-center gap-1 font-semibold text-clover">Read our emissions policy <ArrowRight className="size-4" aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
