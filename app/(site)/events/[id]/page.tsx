import type { Metadata } from 'next';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { notFound } from 'next/navigation';
import { EventRegisterForm } from '@/components/marketing-public/EventRegisterForm';
import { JsonLd } from '@/components/seo/JsonLd';
import { eventSchema } from '@/lib/marketing/content/seo-schema';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{3,80}$/;

async function loadEvent(idOrSlug: string) {
  const key = UUID.test(idOrSlug) ? 'id' : SLUG.test(idOrSlug) ? 'slug' : null;
  if (!key) return null;
  const db = createAdminClient();
  const { data: event } = await db.from('events').select('*').eq(key, idOrSlug).eq('published', true).maybeSingle();
  if (!event) return null;
  const { count } = await db.from('event_registrations').select('id', { count: 'exact', head: true }).eq('event_id', event.id).in('status', ['registered', 'checked_in']);
  return { event, taken: count ?? 0 };
}

const when = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', ...options }).format(new Date(iso));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const loaded = await loadEvent((await params).id);
  if (!loaded) return { robots: { index: false } };
  return {
    title: `${loaded.event.name} | ${BUSINESS.name}`,
    description: loaded.event.description ?? `${loaded.event.name} at ${BUSINESS.name} in ${BUSINESS.city}, ${BUSINESS.region}.`,
    alternates: { canonical: `/events/${loaded.event.slug}` },
  };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const loaded = await loadEvent((await params).id);
  if (!loaded) notFound();
  const { event, taken } = loaded;
  const isPast = new Date(event.ends_at) < new Date();
  const left = event.capacity ? Math.max(0, event.capacity - taken) : null;
  const isOpen = event.registration_open && !isPast;

  return (
    <article className="pb-28 pt-28 sm:pt-36">
      <JsonLd data={eventSchema({ name: event.name, description: event.description, startsAt: event.starts_at, endsAt: event.ends_at, url: `${siteUrl()}/events/${event.slug}`, location: event.location, priceCents: event.price_cents, isFull: left === 0, isPast, base: siteUrl() })} />
      <div className="mx-auto grid max-w-3xl gap-8 px-4 sm:px-6">
        <header className="grid gap-4">
          <p className="kicker">{event.kind === 'dyno_day' ? 'Dyno day' : 'Shop event'}</p>
          <h1 className="display text-[length:var(--text-display)]">{event.name}</h1>
          <ul className="grid gap-2 text-chalk/80 sm:flex sm:flex-wrap sm:gap-6">
            <li className="flex items-center gap-2"><CalendarDays className="size-5 text-clover" aria-hidden="true" />{when(event.starts_at, { weekday: 'short', month: 'short', day: 'numeric' })}, {when(event.starts_at, { hour: 'numeric', minute: '2-digit' })}–{when(event.ends_at, { hour: 'numeric', minute: '2-digit' })}</li>
            <li className="flex items-center gap-2"><MapPin className="size-5 text-clover" aria-hidden="true" />{event.location ?? `${BUSINESS.name}, ${BUSINESS.city}`}</li>
            {left !== null && <li className="flex items-center gap-2"><Users className="size-5 text-clover" aria-hidden="true" /><span className="font-mono tabular-nums">{left}</span> of {event.capacity} spots left</li>}
          </ul>
          {event.description && <p className="max-w-2xl text-lg text-chalk/80">{event.description}</p>}
          {event.price_cents === 0 && <p className="text-chalk/70">Free to attend.</p>}
        </header>

        <section aria-labelledby="signup-heading" className="grid gap-5 rounded-md border border-line bg-carbon-2 p-5 sm:p-8 [[data-design=v2]_&]:rounded-3xl">
          <h2 id="signup-heading" className="display text-3xl">{isOpen ? (left === 0 ? 'Join the waitlist' : 'Save your spot') : 'Sign-ups closed'}</h2>
          {isOpen ? (
            <EventRegisterForm eventId={event.id} isFull={left === 0} />
          ) : (
            <p className="text-chalk/80">Questions? Call <a href={BUSINESS.phoneHref} className="text-clover underline-offset-4 hover:underline">{BUSINESS.phoneDisplay}</a>.</p>
          )}
        </section>
      </div>
    </article>
  );
}
