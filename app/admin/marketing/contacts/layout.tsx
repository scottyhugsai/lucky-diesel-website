import { SectionTabs } from '@/components/admin/marketing/core-ui/MarketingNav';

const TABS = [
  { href: '/admin/marketing/contacts', label: 'People', exact: true },
  { href: '/admin/marketing/contacts/inbox', label: 'Inbox' },
  { href: '/admin/marketing/contacts/tasks', label: 'Today' },
  { href: '/admin/marketing/contacts/pipeline', label: 'Pipeline' },
  { href: '/admin/marketing/contacts/segments', label: 'Segments' },
] as const;

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs items={TABS} label="Contacts sections" />
      {children}
    </>
  );
}
