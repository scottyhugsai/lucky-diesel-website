import Link from 'next/link';
import Image from 'next/image';
import { SocialIcons } from '@/components/ui/SocialIcons';
import { BUSINESS } from '@/lib/site';

const SHOP_LINKS = [
  { href: `${BUSINESS.store}/collections/parts`, label: 'Parts' },
  { href: `${BUSINESS.store}/collections/tuning`, label: 'Tuning' },
  { href: `${BUSINESS.store}/collections/merch`, label: 'Merch' },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-line bg-carbon-2 pb-28 pt-16 lg:pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[auto_1fr_auto] md:items-start md:gap-16">
          <Image src="/images/logo.png" alt="Lucky Diesel" width={120} height={135} className="h-28 w-auto" />

          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="kicker">Contact</h2>
              <ul className="mt-4 space-y-2 text-chalk/80">
                <li><a href={BUSINESS.phoneHref} className="tabular-nums hover:text-clover">{BUSINESS.phoneDisplay}</a></li>
                <li><a href={`mailto:${BUSINESS.email}`} className="hover:text-clover">{BUSINESS.email}</a></li>
              </ul>
            </div>
            <div>
              <h2 className="kicker">Shop</h2>
              <ul className="mt-4 space-y-2 text-chalk/80">
                {SHOP_LINKS.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className="hover:text-clover">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <SocialIcons />
        </div>

        <p aria-hidden="true" className="display mt-16 select-none whitespace-nowrap text-[clamp(4rem,17vw,15rem)] leading-[0.8] text-chalk/[0.04]">
          Lucky Diesel
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm text-steel">
          <p>© {new Date().getFullYear()} {BUSINESS.legalName} · {BUSINESS.city}, {BUSINESS.region}</p>
          <ul className="flex gap-5">
            <li><Link href="/emissions-policy" className="hover:text-clover">Emissions policy</Link></li>
            <li><Link href="/privacy" className="hover:text-clover">Privacy</Link></li>
            <li><Link href="/login" className="hover:text-clover">Customer &amp; staff login</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
