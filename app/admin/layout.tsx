import { AppShell } from '@/components/app/AppShell';
import type { NavItem } from '@/components/app/AppNav';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Admin | Lucky Diesel', robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole('admin');
  const supabase = await createClient();
  const [{ count: newLeads }, { count: awaiting }] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('status', 'awaiting_approval'),
  ]);

  const nav: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: 'LayoutDashboard', exact: true },
    { href: '/admin/leads', label: 'Leads', icon: 'Inbox', badge: newLeads ?? 0 },
    { href: '/admin/jobs', label: 'Jobs', icon: 'Wrench', badge: awaiting ?? 0 },
    { href: '/admin/calendar', label: 'Calendar', icon: 'CalendarDays' },
    { href: '/admin/customers', label: 'Customers', icon: 'Users' },
    { href: '/admin/invoices', label: 'Invoices', icon: 'Receipt' },
    { href: '/admin/gallery', label: 'Gallery', icon: 'Images' },
    { href: '/admin/automations', label: 'Automations', icon: 'Workflow' },
    { href: '/admin/messages', label: 'Messages', icon: 'Smartphone' },
    { href: '/admin/team', label: 'Team', icon: 'Truck' },
    { href: '/admin/settings', label: 'Settings', icon: 'Settings' },
  ];

  return (
    <AppShell viewer={viewer} area="Admin" nav={nav} mobileTabs={['/admin', '/admin/leads', '/admin/jobs', '/admin/calendar', '/admin/messages']}>
      {children}
    </AppShell>
  );
}
