import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { JsonLd } from '@/components/seo/JsonLd';
import { Reveal } from '@/components/ui/Reveal';
import { serviceSchema } from '@/lib/marketing/content/seo-schema';
import { BUSINESS, PLATFORMS, SERVICES } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import { getSiteContent } from '@/lib/site-content/read';
import { str } from '@/lib/site-content/values';

interface PlatformPageProps {
  params: Promise<{ platform: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return PLATFORMS.map((platform) => ({ platform: platform.id }));
}

function findPlatform(id: string) {
  return PLATFORMS.find((platform) => platform.id === id);
}

export async function generateMetadata({ params }: PlatformPageProps): Promise<Metadata> {
  const platform = findPlatform((await params).platform);
  if (!platform) return {};
  const title = `${platform.name} Tuning, Parts & Repair in ${BUSINESS.city}, ${BUSINESS.region} | Lucky Diesel`;
  const description = `${platform.make} ${platform.name} performance tuning, turbos, injectors and repair for every generation. ${BUSINESS.city} diesel shop. Call ${BUSINESS.phoneDisplay}.`;
  return { title, description, alternates: { canonical: `/${platform.id}` }, openGraph: { title, description } };
}

const PLATFORM_SERVICES = ['tuning', 'turbo', 'fuel', 'transmission', 'diagnostics', 'install'];

export default async function PlatformPage({ params }: PlatformPageProps) {
  const platform = findPlatform((await params).platform);
  if (!platform) notFound();
  const copy = (await getSiteContent()).block(`platform.${platform.id}`);

  const services = SERVICES.filter((service) => PLATFORM_SERVICES.includes(service.id));
  const others = PLATFORMS.filter((p) => p.id !== platform.id);

  const base = siteUrl();

  return (
    <>
      <JsonLd data={serviceSchema({ name: `${platform.name} diesel repair and tuning`, description: `${platform.make} ${platform.name} performance tuning, parts and repair. ${platform.tagline}`, url: `${base}/${platform.id}`, serviceType: 'Diesel truck repair and performance', base })} />
      <section aria-labelledby="platform-heading" className="grain relative isolate overflow-hidden pb-16 pt-32 sm:pb-24 sm:pt-40">
        <div
          aria-hidden="true"
          className="absolute -right-40 top-0 -z-10 size-[40rem] rounded-full opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--clover-glow), transparent 65%)' }}
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="text-sm text-steel">
            <Link href="/" className="hover:text-clover">Home</Link> <span aria-hidden="true">/</span>{' '}
            <span className="text-chalk/80">{platform.name}</span>
          </nav>
          <p className="kicker mt-8">{str(copy, 'kicker')}</p>
          <h1 id="platform-heading" className="display rise mt-4 text-[length:var(--text-mega)]">
            {str(copy, 'heading')}
          </h1>
          <p className="mt-6 max-w-xl text-xl text-chalk/75">{str(copy, 'intro')}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={`/?truck=${platform.id}#quote`} className="btn-go display flex items-center justify-center gap-3 rounded-sm px-8 py-4 text-2xl not-italic">
              Get a {platform.name} quote <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
            <Link
              href={`/store/products?platform=${platform.id}`}
              className="flex items-center justify-center gap-2 rounded-sm border border-chalk/25 px-7 py-4 font-semibold hover:border-clover hover:text-clover"
            >
              Shop {platform.name} parts <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="gens-heading" className="border-t border-line py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="gens-heading" className="display text-5xl">Pick your generation</h2>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {platform.generations.map((generation, index) => (
              <Reveal as="li" key={generation} delayMs={index * 50}>
                <div className="group flex h-full flex-col justify-between gap-6 rounded-sm border border-line bg-carbon-2 p-6 transition-colors hover:border-clover">
                  <p className="display text-4xl not-italic tabular-nums">{generation}</p>
                  <div className="flex flex-wrap gap-2 text-sm font-semibold">
                    <Link href={`/?truck=${platform.id}#quote`} className="rounded-sm bg-clover px-3 py-2 text-carbon">
                      Request service
                    </Link>
                    <Link
                      href={`/store/products?platform=${platform.id}&gen=${platform.generationCollections[index]}`}
                      className="inline-flex items-center gap-1 rounded-sm border border-line px-3 py-2 hover:border-clover hover:text-clover"
                    >
                      Parts <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="platform-services-heading" className="bg-carbon-2 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 id="platform-services-heading" className="display text-5xl">{platform.name} services</h2>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <li key={service.id} className="bg-carbon">
                <Link href={`/?truck=${platform.id}&service=${service.id}#quote`} className="group flex h-full flex-col gap-2 p-6 transition-colors hover:bg-gunmetal">
                  <span className="display text-3xl not-italic">{service.name}</span>
                  <span className="text-chalk/65">{service.blurb}</span>
                  {service.partsFrom && (
                    <span className="text-sm font-semibold text-clover tabular-nums">Parts from ${service.partsFrom.toLocaleString('en-US')}</span>
                  )}
                  <span className="mt-auto flex items-center gap-1 pt-3 text-sm font-semibold text-chalk/70 group-hover:text-clover">
                    Request <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 flex items-start gap-2 text-sm text-steel">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-clover" aria-hidden="true" />
            <span>
              Parts prices are current store prices; labor is quoted per job. Read our{' '}
              <Link href="/emissions-policy" className="underline underline-offset-4 hover:text-clover">emissions &amp; tuning policy</Link>.
            </span>
          </p>
        </div>
      </section>

      <section aria-label="Other platforms" className="border-t border-line py-16">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 sm:px-6">
          <p className="kicker">Other trucks</p>
          {others.map((other) => (
            <Link key={other.id} href={`/${other.id}`} className="display text-4xl text-chalk/80 hover:text-clover">
              {other.name}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
