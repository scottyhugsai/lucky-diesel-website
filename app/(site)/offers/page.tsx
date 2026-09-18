import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { listActiveOffers } from '@/lib/marketing/content/landing-service';
import { BUSINESS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Current offers | Lucky Diesel',
  description: `Current service offers and events at ${BUSINESS.name} in ${BUSINESS.city}, ${BUSINESS.region}.`,
  alternates: { canonical: '/offers' },
};

const dateLabel = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }).format(new Date(iso));

export default async function OffersPage() {
  const offers = await listActiveOffers();
  return (
    <section aria-labelledby="offers-heading" className="pb-24 pt-28 sm:pt-36">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6">
        <header className="grid gap-4">
          <p className="kicker">Offers</p>
          <h1 id="offers-heading" className="display text-[length:var(--text-display)]">Current offers</h1>
          <p className="max-w-xl text-lg text-chalk/75">Claim one online and we’ll call to set up a time.</p>
        </header>
        {offers.length === 0 ? (
          <p className="text-chalk/80">No offers running right now. <Link href="/book" className="text-clover underline-offset-4 hover:underline">Book a bay</Link> or call {BUSINESS.phoneDisplay}.</p>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2">
            {offers.map((page) => (
              <li key={page.id} className="grid content-between gap-6 rounded-md border border-line bg-carbon-2 p-6 transition-colors hover:border-clover/50">
                <div className="grid gap-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="kicker">{page.title}</span>
                    {/* The flag is already on the row and was simply not read here.
                        A headline value, a deadline and a claim button are the
                        shape of a real offer; on seeded content that is a promise
                        the shop has not agreed to honour. */}
                    {page.isSample && (
                      <span className="rounded-sm border border-line px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-steel">Example</span>
                    )}
                  </p>
                  <p className="display text-5xl text-clover">{page.offer!.valueLabel}</p>
                  <p className="display text-2xl not-italic">{page.offer!.headline}</p>
                  {page.offer!.terms && <p className="text-sm text-steel">{page.offer!.terms}</p>}
                  {/* No deadline on an example: a countdown is the part that
                      pressures someone into acting on something that is not real. */}
                  {page.offer!.endsAt && !page.isSample && <p className="text-sm text-chalk/80">Ends {dateLabel(page.offer!.endsAt)}</p>}
                </div>
                <Link href={`/l/${page.slug}#claim`} className={`display inline-flex w-fit items-center gap-2 rounded-sm px-5 py-3 text-lg not-italic ${page.isSample ? 'border border-line text-chalk hover:border-clover' : 'btn-go'}`}>
                  {page.isSample ? 'See the example' : 'Claim it'} <ArrowRight className="size-5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
