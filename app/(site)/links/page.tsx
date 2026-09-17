import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { BUSINESS } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: `Links | ${BUSINESS.name}`,
  description: `Everything we point to from Instagram and TikTok: booking, offers, the store and the gallery.`,
  alternates: { canonical: '/links' },
};

/** Fallback buttons so the page is never empty, even before the owner adds any. */
const DEFAULTS = [
  { label: 'Book service', href: '/book?utm_source=instagram&utm_medium=bio' },
  { label: 'Get a quote', href: '/#quote?utm_source=instagram&utm_medium=bio' },
  { label: 'Current offers', href: '/offers?utm_source=instagram&utm_medium=bio' },
  { label: 'Parts store', href: '/store?utm_source=instagram&utm_medium=bio' },
  { label: 'Build gallery', href: '/gallery?utm_source=instagram&utm_medium=bio' },
];

async function loadButtons(): Promise<{ label: string; href: string }[]> {
  try {
    const { data } = await createAdminClient()
      .from('bio_links')
      .select('id, label, sort, short_links(code)')
      .eq('active', true)
      .order('sort')
      .limit(20);
    const rows = (data ?? []).flatMap((row) => (row.short_links?.code ? [{ label: row.label, href: `/r/${row.short_links.code}` }] : []));
    return rows.length ? rows : DEFAULTS;
  } catch (error) {
    console.error(`[marketing] bio links failed: ${error instanceof Error ? error.message : String(error)}`);
    return DEFAULTS;
  }
}

/** Link-in-bio page for Instagram and TikTok. Every tap is counted through /r/. */
export default async function LinksPage() {
  const buttons = await loadButtons();
  return (
    <section aria-labelledby="links-heading" className="pb-28 pt-28 sm:pt-36">
      <div className="mx-auto grid max-w-md gap-6 px-4 sm:px-6">
        <header className="grid gap-2 text-center">
          <p className="kicker justify-self-center">{BUSINESS.city}, {BUSINESS.region}</p>
          <h1 id="links-heading" className="display text-5xl">{BUSINESS.name}</h1>
          <p className="text-chalk/70">Diesel repair, parts and tuning. Pick what you need.</p>
        </header>
        <ul className="grid gap-2.5">
          {buttons.map((button) => (
            <li key={button.label}>
              <Link
                href={button.href}
                className="flex h-14 items-center justify-between gap-3 rounded-sm border border-line bg-carbon-2 px-4 text-lg font-semibold transition-colors hover:border-clover hover:text-clover [[data-design=v2]_&]:rounded-full"
              >
                {button.label}
                <ArrowUpRight className="size-5 shrink-0 text-clover" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-center text-sm text-steel">
          Or call <a href={BUSINESS.phoneHref} className="font-semibold text-clover hover:underline">{BUSINESS.phoneDisplay}</a>
        </p>
      </div>
    </section>
  );
}
