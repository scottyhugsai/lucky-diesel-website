import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import { SERVICE_AREAS } from '@/lib/marketing/content/seo-local';
import { loadAreaPages } from '@/lib/marketing/content/seo-public';
import { BUSINESS } from '@/lib/site';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const pages = await loadAreaPages();
  return {
    title: `Areas We Serve | ${BUSINESS.name} Diesel Shop, ${BUSINESS.city}`,
    description: `${BUSINESS.name} works on diesel trucks from ${BUSINESS.areaServed.join(', ')}.`,
    alternates: { canonical: '/service-areas' },
    ...(pages.length ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function ServiceAreasPage() {
  const pages = await loadAreaPages();
  const live = new Set(pages.map((p) => p.area));
  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-32 sm:px-6 sm:pt-40">
      <p className="kicker">Service areas</p>
      <h1 className="display mt-4 text-[length:var(--text-display)]">Trucks from around {BUSINESS.city}</h1>
      <p className="mt-4 max-w-xl text-lg text-chalk/70">Our shop is in {BUSINESS.city}, {BUSINESS.region}. These are the towns we see trucks from most.</p>
      <ul className="mt-12 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {SERVICE_AREAS.map((area) => (
          <li key={area.slug} className="bg-carbon">
            {live.has(area.slug) ? (
              <Link href={`/service-areas/${area.slug}`} className="group flex h-full items-center justify-between gap-3 p-5 transition-colors hover:bg-gunmetal">
                <span className="flex items-center gap-2 text-lg font-semibold group-hover:text-clover"><MapPin className="size-4 text-clover" aria-hidden="true" />{area.name}</span>
                <ArrowRight className="size-4 text-steel group-hover:text-clover" aria-hidden="true" />
              </Link>
            ) : (
              <p className="flex items-center gap-2 p-5 text-lg font-semibold text-chalk/70"><MapPin className="size-4 text-steel" aria-hidden="true" />{area.name}</p>
            )}
          </li>
        ))}
      </ul>
      <Link href="/#quote" className="btn-go display mt-12 inline-flex items-center gap-2 rounded-sm px-7 py-3.5 text-xl not-italic">
        Get a quote <ArrowRight className="size-5" aria-hidden="true" />
      </Link>
    </div>
  );
}
