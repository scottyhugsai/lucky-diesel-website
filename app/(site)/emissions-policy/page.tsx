import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Emissions & Tuning Policy | Lucky Diesel',
  description: 'How Lucky Diesel handles performance tuning and emissions-related parts.',
  alternates: { canonical: '/emissions-policy' },
};

/*
 * DRAFT for owner + attorney review before go-live. Deliberately avoids making
 * claims about which specific products are compliant — that list must come
 * from the owner and each manufacturer's labeling.
 */
const SECTIONS = [
  {
    title: 'Our approach',
    body: 'We build trucks to perform and to stay on the road. Where a manufacturer offers an emissions-compliant version of a part or calibration, that is what we recommend for street-driven trucks.',
  },
  {
    title: 'Product labeling',
    body: 'Every part and tune we sell carries its manufacturer’s emissions status. Some products are labeled for off-highway or competition use only and are not intended for vehicles driven on public roads. We will tell you which is which before you buy.',
  },
  {
    title: 'Before we start work',
    body: 'For any job that touches emissions-related systems, we review the work with you and ask you to sign an acknowledgement describing the parts, calibration and intended use. You get a copy in your customer portal.',
  },
  {
    title: 'Your responsibility',
    body: 'Federal and state law regulate changes to vehicle emissions systems. Owners are responsible for how their vehicle is used and for keeping it compliant where they drive it.',
  },
  {
    title: 'Questions',
    body: `Call or text ${BUSINESS.phoneDisplay} or email ${BUSINESS.email} before you buy. We’d rather answer a question than sell the wrong part.`,
  },
] as const;

export default function EmissionsPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-6 sm:pt-40">
      <p className="kicker">Policy</p>
      <h1 className="display mt-4 text-[length:var(--text-display)]">Emissions &amp; tuning</h1>
      <p className="mt-4 rounded-sm border border-line bg-carbon-2 px-4 py-3 text-sm text-steel">
        Draft policy pending review. Last updated September 2026.
      </p>
      <div className="mt-12 space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="display text-3xl not-italic">{section.title}</h2>
            <p className="mt-3 text-lg leading-relaxed text-chalk/75">{section.body}</p>
          </section>
        ))}
      </div>
      <Link href="/#quote" className="btn-go display mt-14 inline-flex rounded-sm px-7 py-3.5 text-xl not-italic">
        Talk to us about your build
      </Link>
    </article>
  );
}
