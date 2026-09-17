import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { JsonLd } from '@/components/seo/JsonLd';
import { RelatedLinks } from '@/components/seo/RelatedLinks';
import { FaqList, SeoSections } from '@/components/seo/SeoSections';
import { faqSchema } from '@/lib/marketing/content/seo';
import { findArea } from '@/lib/marketing/content/seo-local';
import { loadAreaPages, loadRelatedLinks } from '@/lib/marketing/content/seo-public';
import { breadcrumbSchema, serviceSchema } from '@/lib/marketing/content/seo-schema';
import { BUSINESS, PLATFORMS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';

interface AreaPageProps {
  params: Promise<{ area: string }>;
}

export const revalidate = 300;

/** Only towns in BUSINESS.areaServed with an approved, published page exist. */
async function load(slug: string) {
  const area = findArea(slug);
  if (!area) return null;
  const page = (await loadAreaPages()).find((p) => p.area === area.slug);
  return page ? { area, page } : null;
}

export async function generateMetadata({ params }: AreaPageProps): Promise<Metadata> {
  const loaded = await load((await params).area);
  if (!loaded) return { robots: { index: false } };
  return {
    title: `${loaded.page.title} | ${BUSINESS.name}`,
    description: loaded.page.metaDescription ?? loaded.page.summary,
    alternates: { canonical: `/service-areas/${loaded.area.slug}` },
  };
}

export default async function AreaPage({ params }: AreaPageProps) {
  const loaded = await load((await params).area);
  if (!loaded) notFound();
  const { area, page } = loaded;
  const base = siteUrl();
  const url = `${base}/service-areas/${area.slug}`;
  const related = await loadRelatedLinks(null, `/service-areas/${area.slug}`);

  return (
    <article className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-6 sm:pt-40">
      <JsonLd data={serviceSchema({ name: page.title, description: page.metaDescription ?? page.summary, url, serviceType: 'Diesel truck repair and performance', base, area: area.name })} />
      <JsonLd data={breadcrumbSchema([{ name: 'Service areas', url: `${base}/service-areas` }, { name: area.name, url }])} />
      <JsonLd data={faqSchema(page.faq)} />
      <nav aria-label="Breadcrumb" className="text-sm text-steel">
        <Link href="/service-areas" className="hover:text-clover">Service areas</Link> <span aria-hidden="true">/</span> <span className="text-chalk/80">{area.name}</span>
      </nav>
      <h1 className="display mt-6 text-[length:var(--text-display)]">{page.title}</h1>
      <p className="mt-4 text-xl text-chalk/75">{page.summary}</p>
      <div className="mt-12"><SeoSections sections={page.body} /></div>
      {page.faq.length > 0 && <div className="mt-14"><FaqList items={page.faq} /></div>}
      <div className="mt-14 flex flex-wrap gap-3">
        <Link href="/#quote" className="btn-go display inline-flex items-center gap-2 rounded-sm px-7 py-3.5 text-xl not-italic">Get a quote <ArrowRight className="size-5" aria-hidden="true" /></Link>
        {PLATFORMS.map((p) => (
          <Link key={p.id} href={`/${p.id}`} className="inline-flex items-center rounded-sm border border-line px-4 py-3 font-semibold hover:border-clover hover:text-clover">{p.name}</Link>
        ))}
      </div>
      <RelatedLinks links={related} />
    </article>
  );
}
