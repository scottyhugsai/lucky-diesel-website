import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { LandingBlock } from '@/lib/marketing/content/landing-blocks';
import { getProof } from '@/lib/marketing/content/landing-service';
import { faqSchema, jsonLd } from '@/lib/marketing/content/seo';
import type { OfferRef } from '@/lib/marketing/content/types';
import { LandingForm } from './LandingForm';

const dateLabel = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' }).format(new Date(iso));

async function Proof({ block }: { block: Extract<LandingBlock, { type: 'proof' }> }) {
  const items = await getProof(block.source, block.limit);
  if (!items.length) return null; // Never pad proof with placeholders.
  return (
    <section aria-labelledby="proof-heading" className="grid gap-6">
      <h2 id="proof-heading" className="display text-4xl">{block.heading}</h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.title} className="flex gap-4 rounded-md border border-line bg-carbon-2 p-4">
            {item.image && <Image src={item.image} alt="" width={96} height={96} className="size-24 shrink-0 rounded-sm object-cover" />}
            <div className="grid content-start gap-1">
              {item.metric && <p className="display text-3xl not-italic text-clover tabular-nums">{item.metric}</p>}
              {item.href ? <Link href={item.href} className="font-semibold hover:text-clover">{item.title}</Link> : <p className="text-chalk/90">{item.title}</p>}
              <p className="text-sm text-steel">{item.subtitle}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Blocks({ blocks, offer, offerExpired }: { blocks: LandingBlock[]; offer: OfferRef | null; offerExpired: boolean }) {
  return (
    <div className="grid gap-16">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'hero':
            return (
              <header key={i} className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
                <div className="grid gap-5">
                  {block.kicker && <p className="kicker">{block.kicker}</p>}
                  <h1 className="display text-[length:var(--text-display)]">{block.headline}</h1>
                  {block.subhead && <p className="max-w-xl text-lg text-chalk/75">{block.subhead}</p>}
                  {block.ctaLabel && !offerExpired && (
                    <a href="#claim" className="btn-go display inline-flex w-fit items-center gap-2 rounded-sm px-6 py-3.5 text-xl not-italic">{block.ctaLabel} <ArrowRight className="size-5" aria-hidden="true" /></a>
                  )}
                </div>
                {block.image && (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-gunmetal">
                    <Image src={block.image} alt="" fill priority sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
                  </div>
                )}
              </header>
            );
          case 'offer':
            return (
              <section key={i} aria-label="Offer" className="grid gap-3 rounded-md border border-clover/40 bg-carbon-2 p-6 sm:p-8">
                <p className="kicker">{offerExpired ? 'Offer ended' : 'The offer'}</p>
                <p className="display text-5xl text-clover">{block.valueLabel}</p>
                <p className="display text-2xl not-italic">{block.headline}</p>
                {block.terms && <p className="text-sm text-steel">{block.terms}</p>}
                <div className="flex flex-wrap gap-4 text-sm">
                  {block.code && <span className="rounded-sm border border-dashed border-clover px-3 py-1 font-semibold tracking-widest">{block.code}</span>}
                  {(offer?.endsAt ?? block.endsAt) && <span className="text-chalk/80">{offerExpired ? 'Ended' : 'Ends'} {dateLabel((offer?.endsAt ?? block.endsAt)!)}</span>}
                </div>
              </section>
            );
          case 'proof':
            return <Proof key={i} block={block} />;
          case 'bullets':
            return (
              <section key={i} className="grid gap-4">
                <h2 className="display text-4xl">{block.heading}</h2>
                <ul className="grid gap-2 sm:grid-cols-2">{block.items.map((item) => <li key={item} className="border-l-2 border-clover pl-3 text-chalk/85">{item}</li>)}</ul>
              </section>
            );
          case 'form':
            return (
              <section key={i} id="claim" aria-labelledby="claim-heading" className="grid scroll-mt-28 gap-6 rounded-md border border-line bg-carbon-2 p-6 sm:p-8">
                <h2 id="claim-heading" className="display text-4xl">{offerExpired ? 'This offer has ended' : block.heading}</h2>
                {offerExpired
                  ? <Link href="/offers" className="btn-go display w-fit rounded-sm px-6 py-3 text-xl not-italic">See current offers</Link>
                  : <LandingForm service={block.service} offerTag={block.offerTag} offerLabel={offer ? `${offer.headline} (${offer.valueLabel})` : null} submitLabel={block.submitLabel} />}
              </section>
            );
          case 'faq': {
            const schema = faqSchema(block.items);
            return (
              <section key={i} className="grid gap-4">
                <h2 className="display text-4xl">{block.heading}</h2>
                <div className="divide-y divide-line border-y border-line">
                  {block.items.map((item) => (
                    <details key={item.q} className="group py-4">
                      <summary className="cursor-pointer font-semibold marker:text-clover">{item.q}</summary>
                      <p className="mt-2 text-chalk/75">{item.a}</p>
                    </details>
                  ))}
                </div>
                {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />}
              </section>
            );
          }
          case 'cta':
            return (
              <section key={i} className="flex flex-wrap items-center justify-between gap-4 border-y border-line py-8">
                <p className="display text-3xl">{block.headline}</p>
                <a href={block.href} className="btn-go display rounded-sm px-6 py-3 text-xl not-italic">{block.label}</a>
              </section>
            );
        }
      })}
    </div>
  );
}
