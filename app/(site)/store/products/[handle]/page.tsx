import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, MessageSquare, Phone, ShieldAlert, Wrench } from 'lucide-react';
import { NotifyMeForm } from '@/components/marketing-public/NotifyMeForm';
import { FitmentCheck } from '@/components/store/FitmentCheck';
import { ProductBuyBox } from '@/components/store/ProductBuyBox';
import { ProductCard } from '@/components/store/ProductCard';
import { ProductGallery } from '@/components/store/ProductGallery';
import { StoreFallback } from '@/components/store/StoreFallback';
import { productsHref, relatedProducts } from '@/components/store/listing';
import { productJsonLd } from '@/components/store/product-json-ld';
import { BTN_GHOST, PILL, TILE, WRAP } from '@/components/store/styles';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import { getCatalog, getProduct } from '@/lib/store/catalog';
import { CATEGORIES } from '@/lib/store/normalize';

interface ProductPageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await getProduct((await params).handle);
  if (!product) return { title: `Part not found | ${BUSINESS.name}` };
  const title = `${product.title} | ${BUSINESS.name}`;
  const description = product.summary || `${product.title} from ${product.vendor}. Shipped or installed by ${BUSINESS.name} in ${BUSINESS.city}, ${BUSINESS.region}.`;
  const image = product.images[0];
  return {
    title,
    description,
    alternates: { canonical: `/store/products/${product.handle}` },
    openGraph: { title, description, images: image ? [{ url: image.src, width: image.width, height: image.height, alt: image.alt }] : undefined },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { handle } = await params;
  const { products, ok } = await getCatalog();
  if (!ok) return <StoreFallback />;
  const product = products.find((p) => p.handle === handle);
  if (!product) notFound();

  const category = CATEGORIES.find((c) => c.id === product.category);
  const related = relatedProducts(products, product);
  const jsonLd = productJsonLd(product, `${siteUrl()}/store/products/${product.handle}`, BUSINESS.name);

  return (
    <div className="pb-28 pt-24 sm:pt-32 lg:pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className={WRAP}>
        <nav aria-label="Breadcrumb" className="truncate text-sm text-steel">
          <Link href="/store" className="hover:text-clover">Store</Link> <span aria-hidden="true">/</span>{' '}
          <Link href={productsHref({ category: product.category })} className="hover:text-clover">{category?.name}</Link>
        </nav>

        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ProductGallery images={product.images} title={product.title} />
          </div>

          <div>
            <p className="kicker">{product.vendor}</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl [[data-design=v2]_&]:font-semibold [[data-design=v2]_&]:tracking-tight">{product.title}</h1>
            <div className="mt-6"><ProductBuyBox product={product} /></div>

            {product.offRoadOnly && (
              <aside className={`mt-6 flex gap-3 border border-amber-300/40 bg-amber-300/10 p-4 text-sm ${TILE}`} aria-label="Emissions notice">
                <ShieldAlert className="size-5 shrink-0 text-amber-300" aria-hidden="true" />
                <p><strong>Off-road use only.</strong> Not legal for use on public roads.{' '}
                  <Link href="/emissions-policy" className="font-semibold text-clover underline underline-offset-4">Emissions policy</Link></p>
              </aside>
            )}

            <div className="mt-6"><FitmentCheck product={product} /></div>
            {!product.available && <div className="mt-6"><NotifyMeForm topic={`product:${product.handle}`.slice(0, 120)} label={product.title} heading="Back-in-stock alert" endpoint="/api/marketing/stock-alert" /></div>}

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
              {related.map((p) => <li key={p.handle}><ProductCard product={p} /></li>)}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
