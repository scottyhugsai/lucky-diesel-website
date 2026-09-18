import Link from 'next/link';
import { SocialIcons } from '@/components/ui/SocialIcons';
import { BUSINESS, PLATFORMS, SERVICES } from '@/lib/site';
import { resolveNav, type SiteNav } from '@/lib/site-nav';

interface FooterLink {
  href: string;
  label: string;
  external?: boolean;
}

const columnsFor = (nav: SiteNav): { title: string; links: FooterLink[] }[] => [
  {
    title: 'Shop',
    links: [
      { href: '/store', label: 'Store' },
      { href: '/build-planner', label: 'Build planner' },
      { href: '/store/products?category=tuning', label: 'Tuning' },
      { href: '/store/products?category=turbo', label: 'Turbochargers' },
      { href: `${BUSINESS.store}/collections/merch`, label: 'Merch', external: true },
    ],
  },
  {
    title: 'Trucks',
    links: PLATFORMS.map((platform) => ({ href: `/${platform.id}`, label: platform.name })),
  },
  {
    title: 'Services',
    links: SERVICES.slice(0, 6).map((service) => ({ href: `/?service=${service.id}#quote`, label: service.name })),
  },
  {
    title: 'Lucky Diesel',
    // Everything the five-item menu could not hold stays reachable here.
    links: [...nav.primary, ...nav.more],
  },
];

/** Apple-style small-type footer. Extra bottom padding clears the mobile action bar. */
export function SiteFooterV2({ nav = resolveNav(null) }: { nav?: SiteNav }) {
  const COLUMNS = columnsFor(nav);
  return (
    <footer className="border-t border-chalk/10 bg-carbon-2 pb-28 pt-8 text-[12px] leading-relaxed text-steel lg:pb-10">
      <div className="mx-auto max-w-[1024px] px-4 sm:px-6">
        <p className="border-b border-chalk/10 pb-5">
          Questions? Call{' '}
          <a href={BUSINESS.phoneHref} className="text-chalk/80 hover:underline">{BUSINESS.phoneDisplay}</a> or email{' '}
          <a href={`mailto:${BUSINESS.email}`} className="text-chalk/80 hover:underline">{BUSINESS.email}</a>. Serving {BUSINESS.areaServed.join(', ')}.
        </p>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 py-8 md:grid-cols-4">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="mb-2 font-semibold text-chalk/90">{column.title}</h2>
              <ul className="space-y-1.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className="hover:text-chalk hover:underline">{link.label}</a>
                    ) : (
                      <Link href={link.href} className="hover:text-chalk hover:underline">{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-4 border-t border-chalk/10 pt-5 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {BUSINESS.legalName} · {BUSINESS.city}, {BUSINESS.region}</p>
          <SocialIcons className="v2-socials" />
        </div>
      </div>
    </footer>
  );
}
