import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { JsonLd } from '@/components/seo/JsonLd';
import { ProductCard } from '@/components/store/ProductCard';
import { generationCollectionFor, generationInfo, generationSlug, productsHref, sortProducts, stockedFirst } from '@/components/store/listing';
import { UseCaseTiers } from '@/components/v4/UseCaseTiers';
import { breadcrumbSchema, serviceSchema } from '@/lib/marketing/content/seo-schema';
import { BUSINESS, PLATFORMS } from '@/lib/site';
import type { PlatformId } from '@/lib/store/normalize';
import { siteUrl } from '@/lib/site-url';
import { filterProducts, getStorefrontCatalog } from '@/lib/store/catalog';
import { applyOverrides } from '@/lib/store/overrides';
import { getSiteContent } from '@/lib/site-content/read';
import { trucksForGeneration } from '@/lib/vehicles';

interface GenerationPageProps {
  params: Promise<{ platform: string; generation: string }>;
}

export const dynamicParams = false;

/**
 * One page per engine generation the site can actually describe.
 *
 * A generation only qualifies when `trucksForGeneration` names at least one
 * truck. Nineteen pages built from the same template would be scaled content;
 * what makes each of these worth having is the list of trucks that carried the
 * engine and the parts that fit it, both of which differ every time. The two
 * 12-valve Cummins generations that ended before the 2001 model year have no
 * truck data, so they get no page and keep their link to the parts listing.
 */
export function generateStaticParams() {
  return PLATFORMS.flatMap((platform) =>
    platform.generationCollections
      .filter((collection) => trucksForGeneration(collection).length > 0)
      .map((collection) => ({ platform: platform.id, generation: generationSlug(platform.id, collection) })),
  );
}

function resolve(platformId: string, slug: string) {
  const platform = PLATFORMS.find((entry) => entry.id === platformId);
  if (!platform) return null;
  const collection = generationCollectionFor(platform.id as PlatformId, slug);
  if (!collection) return null;
  const info = generationInfo(collection);
  const trucks = trucksForGeneration(collection);
  if (!info || !trucks.length) return null;
  return { platform, collection, info, trucks };
}

export async function generateMetadata({ params }: GenerationPageProps): Promise<Metadata> {
  const { platform: platformId, generation } = await params;
  const found = resolve(platformId, generation);
  if (!found) return {};
  const { platform, info, trucks } = found;
  const title = `${info.name} ${platform.name} Parts, Tuning & Repair | ${BUSINESS.name}`;
  const years = trucks[0]?.label ?? info.name;
  const description = `What fits a ${info.name} ${platform.name}: turbos, fuel, tuning and repair for ${years} ${platform.make} trucks. ${BUSINESS.city}, ${BUSINESS.region}. Call ${BUSINESS.phoneDisplay}.`;
  return {
    title,
    description,
    alternates: { canonical: `/${platform.id}/${generation}` },
    openGraph: { title, description },
  };
}

export default async function GenerationPage({ params }: GenerationPageProps) {
  const { platform: platformId, generation } = await params;
  const found = resolve(platformId, generation);
  if (!found) notFound();
  const { platform, collection, info, trucks } = found;

  const [{ products, ok }, content] = await Promise.all([getStorefrontCatalog(), getSiteContent()]);
  const visible = ok ? applyOverrides(products, (handle) => content.product(handle)) : [];
  const fits = stockedFirst(sortProducts(filterProducts(visible, { platform: platform.id, generationCollection: collection }), 'featured'));
  // A showcase of four, not a listing: photographed parts lead, so one missing
  // image does not leave a grey hole beside three product shots. "All parts"
  // below goes to the full list, where the photo-less ones still appear.
  const stocked = fits.filter((product) => product.source !== 'demo');
  const showcase = [...stocked.filter((p) => p.images.length > 0), ...stocked.filter((p) => p.images.length === 0)].slice(0, 4);

  const base = siteUrl();
  const url = `${base}/${platform.id}/${generation}`;
  const listing = productsHref({ platform: platform.id, gen: collection });

  return (
    <>
      <JsonLd data={serviceSchema({ name: `${info.name} ${platform.name} repair and tuning`, description: `Turbos, fuel systems, tuning and repair for the ${info.name} ${platform.name}.`, url, serviceType: 'Diesel truck repair and performance', base })} />
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: base },
        { name: platform.name, url: `${base}/${platform.id}` },
        { name: info.name, url },
      ])} />

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
        <nav aria-label="Breadcrumb" className="text-sm text-steel">
          <Link href="/" className="hover:text-clover">Home</Link> <span aria-hidden="true">/</span>{' '}
          <Link href={`/${platform.id}`} className="hover:text-clover">{platform.name}</Link> <span aria-hidden="true">/</span>{' '}
          <span className="text-chalk/80">{info.short}</span>
        </nav>

        <p className="kicker mt-4">{platform.make} · {platform.name}</p>
        <h1 className="display mt-3 text-[length:var(--text-display)]">{info.name}</h1>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={listing} className="btn-go display inline-flex min-h-12 items-center gap-2 rounded-sm px-6 text-xl not-italic">
            Parts that fit <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
          <Link href="/book" className="inline-flex min-h-12 items-center gap-2 rounded-sm border border-chalk/25 px-6 font-semibold transition-colors hover:border-clover hover:text-clover">
            <CalendarClock className="size-4" aria-hidden="true" /> Book it in
          </Link>
        </div>

        {/* The differentiator. Public vehicle facts, not a claim about the shop. */}
        <section aria-labelledby="trucks-heading" className="mt-14 border-t border-line pt-10">
          <h2 id="trucks-heading" className="display text-3xl sm:text-4xl">Trucks with this engine</h2>
          <ul className="mt-6 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {trucks.map((truck) => (
              <li key={`${truck.truckId}-${truck.label}`} className="bg-carbon p-5">
                <p className="display text-2xl not-italic">{truck.name}</p>
                <p className="v4-num mt-1 text-sm text-steel tabular-nums">{truck.label}</p>
                {truck.engines.length > 0 && (
                  <p className="mt-2 text-sm text-chalk/70">{truck.engines.join(' · ')}</p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {stocked.length > 0 && (
          <section aria-labelledby="parts-heading" className="mt-14 border-t border-line pt-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="parts-heading" className="display text-3xl sm:text-4xl">Parts we stock for it</h2>
              <Link href={listing} className="group inline-flex min-h-11 items-center gap-1.5 font-semibold text-chalk hover:text-clover">
                All {info.short} parts <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
              {showcase.map((product, i) => (
                <li key={product.handle}><ProductCard product={product} priority={i < 2} /></li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="gen-goals-heading" className="mt-14 border-t border-line pt-10">
          <h2 id="gen-goals-heading" className="display text-3xl sm:text-4xl">What is it for?</h2>
          <p className="mt-2 max-w-xl text-steel">Same engine, three different jobs. Each says what it costs you and what it does not.</p>
          <div className="mt-6"><UseCaseTiers /></div>
        </section>

        <section aria-labelledby="siblings-heading" className="mt-14 border-t border-line pt-10">
          <h2 id="siblings-heading" className="display text-3xl sm:text-4xl">Other {platform.name} years</h2>
          <ul className="mt-6 flex flex-wrap gap-2">
            {platform.generationCollections.map((sibling, index) => {
              const name = platform.generations[index];
              if (!name || sibling === collection) return null;
              const hasPage = trucksForGeneration(sibling).length > 0;
              const href = hasPage
                ? `/${platform.id}/${generationSlug(platform.id as PlatformId, sibling)}`
                : productsHref({ platform: platform.id, gen: sibling });
              return (
                <li key={sibling}>
                  <Link href={href} className="inline-flex min-h-11 items-center rounded-sm border border-line px-4 text-sm font-semibold transition-colors hover:border-clover hover:text-clover">
                    {name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
