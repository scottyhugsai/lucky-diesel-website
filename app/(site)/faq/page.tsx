import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/seo/JsonLd';
import { FaqList } from '@/components/seo/SeoSections';
import { faqSchema } from '@/lib/marketing/content/seo';
import { loadFaqItems } from '@/lib/marketing/content/seo-public';
import { BUSINESS } from '@/lib/site';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const items = await loadFaqItems();
  return {
    title: `Diesel Repair & Performance FAQ | ${BUSINESS.name} ${BUSINESS.city}`,
    description: `Answers to common questions about diesel service, parts and tuning at ${BUSINESS.name} in ${BUSINESS.city}, ${BUSINESS.region}.`,
    alternates: { canonical: '/faq' },
    ...(items.length ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function FaqPage() {
  const items = await loadFaqItems();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-6 sm:pt-40">
      <JsonLd data={faqSchema(items)} />
      <p className="kicker">FAQ</p>
      <h1 className="display mt-4 text-[length:var(--text-display)]">Straight answers</h1>
      <p className="mt-4 text-lg text-chalk/70">Don’t see yours? Text or call <a href={BUSINESS.phoneHref} className="text-clover underline-offset-4 hover:underline">{BUSINESS.phoneDisplay}</a>.</p>
      <div className="mt-12">
        {items.length ? <FaqList items={items} /> : <p className="rounded-md border border-line bg-carbon-2 p-6 text-chalk/70">Answers are being written now.</p>}
      </div>
      <p className="mt-10 text-sm text-steel">
        Tuning questions? Read our <Link href="/emissions-policy" className="underline underline-offset-4 hover:text-clover">emissions &amp; tuning policy</Link>.
      </p>
    </div>
  );
}
