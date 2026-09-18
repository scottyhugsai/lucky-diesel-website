import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { BUSINESS } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: `Dyno days & events | ${BUSINESS.name}`,
  description: `Dyno days and shop events at ${BUSINESS.name} in ${BUSINESS.city}, ${BUSINESS.region}.`,
  alternates: { canonical: '/events' },
};

const when = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

export default async function EventsPage() {
  const { data } = await createAdminClient().from('events').select('id, slug, name, description, starts_at, capacity, is_sample').eq('published', true).gte('ends_at', new Date().toISOString()).order('starts_at');
  const events = data ?? [];
  return (
    <section aria-labelledby="events-heading" className="pb-28 pt-28 sm:pt-36">
      <div className="mx-auto grid max-w-4xl gap-8 px-4 sm:px-6">
        <header className="grid gap-3">
          <p className="kicker">Events</p>
          <h1 id="events-heading" className="display text-[length:var(--text-display)]">Dyno days</h1>
          <p className="text-lg text-chalk/75">Bring the truck. Get real numbers.</p>
        </header>
        {events.length === 0 ? (
          <p className="text-chalk/80">Nothing scheduled yet. Call {BUSINESS.phoneDisplay} to get on the list.</p>
        ) : (
          <ul className="grid gap-4">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.slug}`} className="group grid gap-2 rounded-md border border-line bg-carbon-2 p-5 transition-colors hover:border-clover/60 sm:p-6 [[data-design=v2]_&]:rounded-2xl">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-clover">{when(e.starts_at)}</span>
                    {/* A seeded event has a real-looking date, a capacity and a
                        working sign-up. Saying so is the difference between a
                        demo and a customer turning up to a shop that is not
                        expecting them. */}
                    {e.is_sample && (
                      <span className="rounded-sm border border-line px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-steel">Example</span>
                    )}
                  </span>
                  <span className="display text-3xl not-italic">{e.name}</span>
                  {e.description && <span className="line-clamp-2 text-chalk/75">{e.description}</span>}
                  <span className="inline-flex items-center gap-1.5 font-semibold text-clover">{e.is_sample ? 'See the example' : 'Save a spot'} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
