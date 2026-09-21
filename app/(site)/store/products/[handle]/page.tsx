import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Info, MessageSquare, Phone, ShieldAlert, Wrench } from 'lucide-react';
import { NotifyMeForm } from '@/components/marketing-public/NotifyMeForm';
import { CompareWithSimilar } from '@/components/store/CompareWithSimilar';
import { FitmentCheck } from '@/components/store/FitmentCheck';
import { ProductBuyBox } from '@/components/store/ProductBuyBox';
import { ProductCard } from '@/components/store/ProductCard';
import { ProductGallery } from '@/components/store/ProductGallery';
import { RecentlyViewed } from '@/components/store/RecentlyViewed';
import { RecordRecent } from '@/components/store/RecordRecent';
import { SampleQuoteBox } from '@/components/store/SampleQuoteBox';
import { StoreFallback } from '@/components/store/StoreFallback';
import { TruckBar } from '@/components/store/TruckBar';
import { productsHref, relatedProducts } from '@/components/store/listing';
import { productJsonLd } from '@/components/store/product-json-ld';
import { BTN_GHOST, PILL, TILE, WRAP } from '@/components/store/styles';
import { readRecent } from '@/components/store/recent-server';
import { recentProducts } from '@/components/store/recent';
import { readSavedTruck } from '@/lib/fitment/truck-server';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { merchantDetails, policyFromSettings } from '@/lib/store/merchant';
import { getSiteContent } from '@/lib/site-content/read';
import { getProduct, getStorefrontCatalog } from '@/lib/store/catalog';
import { applyOverrides } from '@/lib/store/overrides';
import { CATEGORIES } from '@/lib/store/normalize';

interface ProductPageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await getProduct((await params).handle);
  if (!product) return { title: `Part not found | ${BUSINESS.name}` };
  const title = `${product.title} | ${BUSINESS.name}`;
  const description = product.summary || `${product.title} from ${product.vendor}. Shipped or installed by ${BUSINESS.name} in ${BUSINESS.city}, ${BUSINESS.region}.`;
  return {
    title,
    description,
    alternates: { canonical: `/store/products/${product.handle}` },
    // The photo is not dropped — opengraph-image.tsx renders it inside a card
    // that also carries the shop, the price and whether it is a sample listing.
    openGraph: { title, description },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { handle } = await params;
  const [{ products, ok }, content, truck, seen] = await Promise.all([getStorefrontCatalog(), getSiteContent(), readSavedTruck(), readRecent()]);
  if (!ok) return <StoreFallback />;
  const visible = applyOverrides(products, (key) => content.product(key));
  const product = visible.find((p) => p.handle === handle);
  if (!product) notFound();

  const category = CATEGORIES.find((c) => c.id === product.category);
  const related = relatedProducts(visible, product, 4, truck);
  // The part being read is left out; it is the one thing the visitor can already see.
  const recent = recentProducts(visible, seen, { exclude: product.handle, limit: 4 });
  // Shipping and returns appear only once the owner has recorded them.
  const { data: settings } = await createAdminClient()
    .from('shop_settings')
    .select('ships_products, shipping_flat_cents, shipping_free_over_cents, shipping_handling_days, shipping_transit_days, returns_days, returns_url')
    .eq('id', 1)
    .maybeSingle();
  const jsonLd = productJsonLd(
    product,
    `${siteUrl()}/store/products/${product.handle}`,
    BUSINESS.name,
    merchantDetails(policyFromSettings(settings)),
  );

  return (
    <div className="pb-28 pt-24 sm:pt-32 lg:pb-20">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      <RecordRecent handle={product.handle} />
      <div className={WRAP}>
        <nav aria-label="Breadcrumb" className="truncate text-sm text-steel">
          <Link href="/store" className="hover:text-clover">Store</Link> <span aria-hidden="true">/</span>{' '}
          <Link href={productsHref({ category: product.category })} className="hover:text-clover">{category?.name}</Link>
        </nav>

        <div className="mt-4"><TruckBar truck={truck} returnTo={`/store/products/${product.handle}`} /></div>

        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ProductGallery images={product.images} title={product.title} />
          </div>

          <div>
            <p className="kicker">{product.vendor}</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl [[data-design=v2]_&]:font-semibold [[data-design=v2]_&]:tracking-tight">{product.title}</h1>

            {product.source === 'demo' && (
              <aside className={`mt-5 flex gap-3 border border-line bg-chalk/5 p-4 text-sm ${TILE}`} aria-label="Sample listing">
                <Info className="size-5 shrink-0 text-steel" aria-hidden="true" />
                <p><strong>Sample listing.</strong> Shown to demonstrate catalogue coverage. It is not stocked and cannot be bought here — ask us and we will price it.</p>
              </aside>
            )}

            <div className="mt-6">
              {product.purchasable ? <ProductBuyBox product={product} /> : <SampleQuoteBox product={product} />}
            </div>

            {product.fitmentLabels.length > 0 && (
              <section aria-label="Fitment" className="mt-6">
                <h2 className="text-sm font-semibold text-chalk/85">Fits</h2>
                <ul className="mt-2 grid gap-1 text-sm text-steel">
                  {product.fitmentLabels.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </section>
            )}

            {product.offRoadOnly && (
              <aside className={`mt-6 flex gap-3 border border-amber-300/40 bg-amber-300/10 p-4 text-sm ${TILE}`} aria-label="Emissions notice">
                <ShieldAlert className="size-5 shrink-0 text-amber-300" aria-hidden="true" />
                <p><strong>Off-road use only.</strong> Not legal for use on public roads.{' '}
                  <Link href="/emissions-policy" className="font-semibold text-clover underline underline-offset-4">Emissions policy</Link></p>
              </aside>
            )}

            <div className="mt-6"><FitmentCheck product={product} initialTruck={truck} /></div>
            <div className="mt-6"><CompareWithSimilar product={product} similar={related} truck={truck} /></div>
            {!product.available && product.purchasable && <div className="mt-6"><NotifyMeForm topic={`product:${product.handle}`.slice(0, 120)} label={product.title} heading="Back-in-stock alert" endpoint="/api/marketing/stock-alert" /></div>}

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Link href="/book?service=install" className={BTN_GHOST}><Wrench className="size-4" aria-hidden="true" /> Book install</Link>
              <div className="flex gap-2">
                <a href={BUSINESS.phoneHref} className={`${BTN_GHOST} flex-1 px-3`} aria-label={`Call ${BUSINESS.phoneDisplay}`}><Phone className="size-4" aria-hidden="true" /> Call</a>
                <a href={BUSINESS.smsHref} className={`${BTN_GHOST} flex-1 px-3`} aria-label={`Text ${BUSINESS.phoneDisplay}`}><MessageSquare className="size-4" aria-hidden="true" /> Text</a>
              </div>
            </div>
            <p className="mt-2 text-sm text-steel">We can install it. Questions? Call or text <a href={BUSINESS.phoneHref} className="font-semibold text-chalk/80 tabular-nums hover:text-clover">{BUSINESS.phoneDisplay}</a>.</p>

            {(product.intro.length > 0 || product.bullets.length > 0) && (
              <section aria-labelledby="details-heading" className="mt-10 border-t border-line pt-8">
                <h2 id="details-heading" className="display text-3xl not-italic [[data-design=v2]_&]:text-2xl">Details</h2>
                {product.intro.slice(0, 2).map((text) => <p key={text} className="mt-4 text-chalk/75">{text}</p>)}
                {product.bullets.length > 0 && (
                  <ul className="mt-5 space-y-2">
                    {product.bullets.map((bullet, i) => (
                      <li key={`${bullet.label}-${i}`} className="flex gap-2 text-chalk/80">
                        <span aria-hidden="true" className={`mt-2 size-1.5 shrink-0 bg-clover ${PILL}`} />
                        <span>{bullet.label && <strong className="text-chalk">{bullet.label}: </strong>}{bullet.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-16 border-t border-line pt-12 [[data-design=v2]_&]:border-transparent">
          <div className={WRAP}>
            <div className="flex items-end justify-between gap-4">
              <h2 id="related-heading" className="display text-4xl sm:text-5xl [[data-design=v2]_&]:text-3xl">You might also need</h2>
              <Link href={productsHref({ category: product.category, platform: product.platforms[0] ?? null })} className="flex min-h-11 shrink-0 items-center gap-1 font-semibold text-clover">More <ArrowRight className="size-4" aria-hidden="true" /></Link>
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
              {related.map((p) => <li key={p.handle}><ProductCard product={p} truck={truck} /></li>)}
            </ul>
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="mt-16 border-t border-line pt-12 [[data-design=v2]_&]:border-transparent">
          <div className={WRAP}>
            <h2 id="recent-heading" className="display text-4xl sm:text-5xl [[data-design=v2]_&]:text-3xl">Recently viewed</h2>
            <RecentlyViewed products={recent} />
          </div>
        </section>
      )}
    </div>
  );
}
