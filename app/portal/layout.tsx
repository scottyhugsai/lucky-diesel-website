import { AppShell } from '@/components/app/AppShell';
import type { NavItem } from '@/components/app/AppNav';
import { requireRole } from '@/lib/auth';

export const metadata = { title: 'My Garage | Lucky Diesel', robots: { index: false } };

const NAV: NavItem[] = [
  { href: '/portal', label: 'Garage', icon: 'Home', exact: true },
  { href: '/portal/jobs', label: 'Jobs', icon: 'Wrench' },
  { href: '/portal/book', label: 'Book', icon: 'CalendarDays' },
  { href: '/portal/invoices', label: 'Invoices', icon: 'Receipt' },
  { href: '/portal/messages', label: 'Messages', icon: 'MessageSquare' },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole('client');
  return (
    <AppShell viewer={viewer} area="My Garage" nav={NAV}>
      {children}
    </AppShell>
  );
}
