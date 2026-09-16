import { AppShell } from '@/components/app/AppShell';
import type { NavItem } from '@/components/app/AppNav';
import { requireRole } from '@/lib/auth';

export const metadata = { title: 'Shop Floor | Lucky Diesel', robots: { index: false } };

const NAV: NavItem[] = [
  { href: '/shop', label: 'My jobs', icon: 'ClipboardList', exact: true },
  { href: '/shop/schedule', label: 'Schedule', icon: 'CalendarDays' },
  { href: '/shop/time', label: 'Time', icon: 'Clock' },
];

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole('employee', 'admin');
  return (
    <AppShell viewer={viewer} area="Shop floor" nav={NAV}>
      {children}
    </AppShell>
  );
}
