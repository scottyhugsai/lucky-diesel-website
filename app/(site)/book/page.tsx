import type { Metadata } from 'next';
import { BookingForm } from '@/components/booking/BookingForm';
import { truckPrefill } from '@/lib/fitment/prefill';
import { readSavedTruck } from '@/lib/fitment/truck-server';
import { BUSINESS } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { seoMetadata } from '@/lib/site-content/metadata';
import { getSiteContent } from '@/lib/site-content/read';
import { lines, str } from '@/lib/site-content/values';

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata('book', '/book');
}

export const dynamic = 'force-dynamic';

const DAYS_AHEAD = 21;

/** The next bookable shop days, as YYYY-MM-DD in shop time. */
async function openDates(): Promise<{ value: string; weekday: string; day: string; month: string }[]> {
  const { data: settings } = await createAdminClient().from('shop_settings').select('open_days').eq('id', 1).maybeSingle();
  const openDays = settings?.open_days ?? [1, 2, 3, 4, 5];
  const fmt = (options: Intl.DateTimeFormatOptions, at: Date) => new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'America/New_York' }).format(at);
  const dates = [];
  for (let offset = 0; offset < DAYS_AHEAD && dates.length < 12; offset += 1) {
    const at = new Date(Date.now() + offset * 86_400_000);
    const value = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(at);
    if (!openDays.includes(new Date(`${value}T12:00:00Z`).getUTCDay())) continue;
    dates.push({ value, weekday: fmt({ weekday: 'short' }, at), day: fmt({ day: 'numeric' }, at), month: fmt({ month: 'short' }, at) });
  }
  return dates;
}

export default async function BookPage() {
  const [dates, content, saved] = await Promise.all([openDates(), getSiteContent(), readSavedTruck()]);
  const copy = content.block('page.book');
  // Read on the server so the form arrives already knowing the truck, rather
  // than asking again for something the fitment picker was told.
  const prefill = truckPrefill(saved);
  const [headline, ...headingRest] = lines(copy, 'heading');
  return (
    <section className="grain relative isolate overflow-hidden pb-24 pt-32 sm:pt-40">
      <div aria-hidden="true" className="absolute -left-40 top-20 -z-10 size-[36rem] rounded-full opacity-40 blur-3xl" style={{ background: 'radial-gradient(circle, var(--clover-glow), transparent 65%)' }} />
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="kicker">{str(copy, 'kicker')}</p>
          <h1 className="display mt-4 text-[length:var(--text-display)]">
            {headline}
            {headingRest.map((line) => <span key={line} className="block text-clover">{line}</span>)}
          </h1>
          <p className="mt-6 max-w-sm text-lg text-chalk/70">{str(copy, 'intro')}</p>
          <p className="mt-8 text-chalk/60">
            Rather talk it through? Call or text{' '}
            <a href={BUSINESS.phoneHref} className="font-semibold text-clover">{BUSINESS.phoneDisplay}</a>.
          </p>
        </div>
        <div className="rounded-md border border-line bg-carbon-2/90 p-5 backdrop-blur sm:p-8">
          <BookingForm dates={dates} initialPlatform={prefill.platform} initialGeneration={prefill.generation} />
        </div>
      </div>
    </section>
  );
}
