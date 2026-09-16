'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ICONS, type NavIconName } from './icons';

export interface NavItem {
  href: string;
  label: string;
  /** Icon name from NAV_ICONS. Names keep this serializable across the server boundary. */
  icon: NavIconName;
  badge?: number;
  /** Exact match only (for area roots like /admin). */
  exact?: boolean;
}

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppNav({ items, layout }: { items: NavItem[]; layout: 'sidebar' | 'tabs' }) {
  const pathname = usePathname();

  if (layout === 'tabs') {
    return (
      <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-carbon/95 backdrop-blur-xl lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((item) => {
            const Icon = NAV_ICONS[item.icon];
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? 'page' : undefined} className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold ${active ? 'text-clover' : 'text-steel'}`}>
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                  {item.badge ? <span className="absolute right-1/4 top-2 grid min-w-4 place-items-center rounded-full bg-clover px-1 text-[0.6rem] text-carbon">{item.badge}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="App" className="px-3">
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`group flex h-10 items-center gap-3 rounded-sm px-3 text-sm font-semibold transition-colors ${active ? 'bg-clover/10 text-clover' : 'text-chalk/70 hover:bg-gunmetal hover:text-chalk'}`}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? <span className="rounded-full bg-clover px-1.5 text-xs font-bold text-carbon tabular-nums">{item.badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
