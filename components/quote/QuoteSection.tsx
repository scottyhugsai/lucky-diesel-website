'use client';

import { Mail, MessageSquare, Phone } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { SocialIcons } from '@/components/ui/SocialIcons';
import type { BlockValues } from '@/lib/site-content/fields';
import { lines, str } from '@/lib/site-content/values';
import { BUSINESS } from '@/lib/site';
import { useStore } from '@/components/store/CartProvider';
import { truckPrefill } from '@/lib/fitment/prefill';
import { QuoteForm } from './QuoteForm';

const CONTACTS = [
  { href: BUSINESS.phoneHref, label: 'Call', value: BUSINESS.phoneDisplay, Icon: Phone },
  { href: BUSINESS.smsHref, label: 'Text', value: BUSINESS.phoneDisplay, Icon: MessageSquare },
  { href: `mailto:${BUSINESS.email}`, label: 'Email', value: BUSINESS.email, Icon: Mail },
] as const;

/** Reads ?truck= and ?service= so platform and service links preselect the form. */
export function QuoteSectionFromUrl({ values }: { values: BlockValues }) {
  const params = useSearchParams();
  // A truck named in the URL is an explicit choice and wins. Otherwise fall
  // back to the one the visitor already picked in the fitment picker, so the
  // form does not ask a question they have answered — in a different
  // vocabulary from the one they answered it in.
  const { savedTruck, truckReady } = useStore();
  const saved = truckReady ? truckPrefill(savedTruck) : { platform: '', generation: '' };
  const fromUrl = params.get('truck') ?? '';
  return (
    <QuoteSection
      values={values}
      truck={fromUrl || saved.platform}
      generation={fromUrl ? '' : saved.generation}
      service={params.get('service') ?? ''}
      about={params.get('about') ?? ''}
    />
  );
}

interface QuoteSectionProps {
  values: BlockValues;
  truck?: string;
  /** The engine behind `truck`, when it came from a full fitment pick. */
  generation?: string;
  service?: string;
  /** Seeds the details box — used by "Get a price" on a part. */
  about?: string;
}

export function QuoteSection({ values, truck = '', generation = '', service = '', about = '' }: QuoteSectionProps) {
  const [headline, ...rest] = lines(values, 'heading');
  return (
    <section id="quote" aria-labelledby="quote-heading" className="grain relative isolate overflow-hidden border-t border-line py-20 sm:py-28">
      <div aria-hidden="true" className="speed-stripes absolute -left-16 top-0 -z-10 h-full w-40 -skew-x-[20deg] opacity-[0.06]" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <p className="kicker">{str(values, 'kicker')}</p>
          <h2 id="quote-heading" className="display mt-3 text-[length:var(--text-display)]">
            {headline}
            {rest.map((line) => <span key={line} className="block text-clover">{line}</span>)}
          </h2>
          <p className="mt-6 max-w-sm text-lg text-chalk/70">{str(values, 'intro')}</p>

          <ul className="mt-10 grid gap-2">
            {CONTACTS.map(({ href, label, value, Icon }) => (
              <li key={label}>
                <a href={href} className="group flex items-center gap-4 rounded-sm border border-line p-4 transition-colors duration-200 hover:border-clover">
                  <span className="grid size-11 place-items-center rounded-full bg-gunmetal text-clover transition-colors group-hover:bg-clover group-hover:text-carbon">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xs uppercase tracking-widest text-steel">{label}</span>
                    <span className="block font-semibold tabular-nums">{value}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <SocialIcons className="mt-6" />
        </div>

        <div className="relative lg:col-span-7">
          <div className="rounded-sm border border-line bg-carbon-2/90 p-5 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.8)] backdrop-blur sm:p-8">
            <QuoteForm key={`${truck}|${generation}|${service}|${about}`} initialPlatform={truck} initialGeneration={generation} initialService={service} initialDetails={about} />
          </div>
        </div>
      </div>
    </section>
  );
}
