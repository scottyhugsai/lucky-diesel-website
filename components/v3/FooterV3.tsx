import Link from 'next/link';
import { SocialIcons } from '@/components/ui/SocialIcons';
import { BUSINESS, PLATFORMS } from '@/lib/site';
import { MONO, WRAP } from './ui';

const LINKS = [
  { href: '/store', label: 'Store' },
  { href: '/build-planner', label: 'Build planner' },
  { href: '/book', label: 'Book' },
  { href: '/builds', label: 'Builds' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/login', label: 'Log in' },
] as const;

const POLICIES = [
  { href: '/emissions-policy', label: 'Emissions policy' },
  { href: '/privacy', label: 'Privacy' },
] as const;

/** NAP first, then links, policies and socials. Bottom padding clears the tab bar and pill on phones. */
export function FooterV3() {
  return (
    <footer className="v3-footer border-t border-line bg-carbon-2 pt-10 text-sm text-steel">
      <div className={`${WRAP} grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]`}>
        <div>
          <p className="v3-title text-lg font-semibold text-chalk">{BUSINESS.legalName}</p>
          <p className="mt-1">{BUSINESS.city}, {BUSINESS.region}</p>
          <a href={BUSINESS.phoneHref} className={`${MONO} mt-3 inline-block text-xl text-clover hover:underline underline-offset-4`}>{BUSINESS.phoneDisplay}</a>
          <p className="mt-1"><a href={`mailto:${BUSINESS.email}`} className="hover:text-chalk">{BUSINESS.email}</a></p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed">Serving {BUSINESS.areaServed.join(', ')}.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-1">
            {LINKS.map((link) => (
              <li key={link.href}><Link href={link.href} className="inline-block min-h-8 leading-8 hover:text-chalk">{link.label}</Link></li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="mb-2 font-semibold text-chalk/85">Trucks</p>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-1">
            {PLATFORMS.map((platform) => (
              <li key={platform.id}><Link href={`/${platform.id}`} className="inline-block min-h-8 leading-8 hover:text-chalk">{platform.name}</Link></li>
            ))}
          </ul>
        </div>
      </div>
      <div className={`${WRAP} mt-8 flex flex-col gap-4 border-t border-line py-5 text-xs md:flex-row md:items-center md:justify-between`}>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className={MONO}>© {new Date().getFullYear()} {BUSINESS.legalName}</span>
          {POLICIES.map((policy) => <Link key={policy.href} href={policy.href} className="hover:text-chalk">{policy.label}</Link>)}
        </p>
        <SocialIcons className="v3-socials" />
      </div>
    </footer>
  );
}
