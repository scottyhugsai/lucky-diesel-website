import Image from 'next/image';
import Link from 'next/link';
import { SocialIcons } from '@/components/ui/SocialIcons';
import { BUSINESS, PLATFORMS } from '@/lib/site';
import { resolveNav, type SiteNav } from '@/lib/site-nav';
import { WRAP } from './ui';

/** Contact first, then everything the five-item menu could not hold. */
export function SiteFooterV4({ nav = resolveNav(null) }: { nav?: SiteNav }) {
  return (
    <footer className="border-t border-line pb-24 pt-14 text-[0.9375rem] text-steel lg:pb-12">
      <div className={`${WRAP} grid gap-10 md:grid-cols-[1.3fr_1fr_1fr]`}>
        <div>
          <div className="flex items-center gap-2.5">
            <Image src="/images/logo-mark.png" alt="" width={698} height={505} className="h-7 w-auto" />
            <span className="v4-title text-base text-chalk">Lucky Diesel</span>
          </div>
          <p className="mt-3">{BUSINESS.city}, {BUSINESS.region}</p>
          <a href={BUSINESS.phoneHref} className="v4-num mt-1 inline-flex min-h-11 items-center text-xl text-chalk hover:text-clover">{BUSINESS.phoneDisplay}</a>
          <p><a href={`mailto:${BUSINESS.email}`} className="inline-flex min-h-11 items-center hover:text-chalk">{BUSINESS.email}</a></p>
          <div className="mt-5"><SocialIcons /></div>
        </div>

        <nav aria-label="Site">
          <h2 className="kicker">Site</h2>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 sm:block">
            {[...nav.primary, ...nav.more].map((link) => (
              <li key={link.href}><Link href={link.href} className="flex min-h-11 items-center hover:text-chalk">{link.label}</Link></li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Trucks">
          <h2 className="kicker">Trucks</h2>
          <ul className="mt-2">
            {PLATFORMS.map((platform) => (
              <li key={platform.id}><Link href={`/${platform.id}`} className="flex min-h-11 items-center hover:text-chalk">{platform.name}</Link></li>
            ))}
          </ul>
        </nav>
      </div>

      <div className={`${WRAP} mt-10 border-t border-line pt-5 text-[0.8125rem]`}>
        <p>© {new Date().getFullYear()} {BUSINESS.legalName}</p>
      </div>
    </footer>
  );
}
