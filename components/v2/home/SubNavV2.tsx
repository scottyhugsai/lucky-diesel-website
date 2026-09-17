import Link from 'next/link';

const LOCAL_NAV = [
  { href: '#trucks', label: 'Trucks' },
  { href: '#explore', label: 'Explore' },
  { href: '#parts', label: 'Parts' },
  { href: '#services', label: 'Services' },
  { href: '#quote', label: 'Contact' },
] as const;

/** Apple's product sub-nav: page name left, section anchors and the buy action right. Sticks under the main bar. */
export function SubNavV2() {
  return (
    <nav aria-label="On this page" className="v2-bar sticky top-12 z-40 border-b border-chalk/10">
      <div className="mx-auto flex h-11 max-w-[1024px] items-center justify-between gap-6 px-4 sm:px-6">
        <span className="shrink-0 text-[17px] font-semibold tracking-tight text-chalk">Lucky Diesel</span>
        <div className="flex min-w-0 items-center gap-5">
          <ul className="v2-scroll flex items-center gap-5 overflow-x-auto whitespace-nowrap text-[12px] text-chalk/80">
            {LOCAL_NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="transition-colors hover:text-chalk">{item.label}</a>
              </li>
            ))}
          </ul>
          <Link href="/book" className="hidden h-7 shrink-0 items-center rounded-full bg-clover px-3.5 text-[12px] font-medium text-carbon hover:brightness-110 sm:inline-flex">
            Book
          </Link>
        </div>
      </div>
    </nav>
  );
}
