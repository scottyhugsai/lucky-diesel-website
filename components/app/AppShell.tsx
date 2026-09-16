import Image from 'next/image';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { signOut } from '@/app/auth/actions';
import type { Viewer } from '@/lib/auth';
import { AppNav, type NavItem } from './AppNav';
import { Avatar } from './ui';

interface AppShellProps {
  viewer: Viewer;
  area: string;
  nav: NavItem[];
  children: React.ReactNode;
  /** Phones get a bottom tab bar with these hrefs (max 5). */
  mobileTabs?: string[];
}

export function AppShell({ viewer, area, nav, children, mobileTabs }: AppShellProps) {
  const { profile } = viewer;
  return (
    <div className="min-h-dvh bg-carbon lg:grid lg:grid-cols-[15.5rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-carbon-2 lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
          <Image src="/images/logo-mark.png" alt="" width={40} height={29} className="h-7 w-auto" />
          <span className="display text-xl not-italic leading-none">
            <span className="text-clover">Lucky</span> Diesel
          </span>
        </Link>
        <p className="px-5 pb-3 text-xs font-semibold uppercase tracking-widest text-steel">{area}</p>
        <AppNav items={nav} layout="sidebar" />
        <div className="mt-auto border-t border-line p-4">
          <div className="flex items-center gap-3">
            <Avatar name={profile.full_name || profile.email || '?'} color={profile.avatar_color} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{profile.full_name || profile.email}</p>
              <p className="truncate text-xs text-steel">{profile.title ?? profile.role}</p>
            </div>
            <form action={signOut}>
              <button type="submit" className="grid size-9 place-items-center rounded-sm text-steel hover:bg-gunmetal hover:text-chalk" aria-label="Sign out">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-carbon/90 px-4 backdrop-blur-xl lg:hidden" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <Link href="/" className="flex items-center gap-2">
            <Image src="/images/logo-mark.png" alt="" width={34} height={25} className="h-6 w-auto" />
            <span className="display text-lg not-italic"><span className="text-clover">Lucky</span> Diesel</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-steel">{area}</span>
            <form action={signOut}>
              <button type="submit" className="grid size-9 place-items-center rounded-sm text-steel hover:text-chalk" aria-label="Sign out">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
        <AppNav items={nav.filter((item) => !mobileTabs || mobileTabs.includes(item.href)).slice(0, 5)} layout="tabs" />
      </div>
    </div>
  );
}
