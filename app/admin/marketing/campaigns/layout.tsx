import { SectionTabs } from '@/components/admin/marketing/core-ui/MarketingNav';

const TABS = [
  { href: '/admin/marketing/campaigns', label: 'Campaigns', exact: true },
  { href: '/admin/marketing/campaigns/seasonal', label: 'Seasonal' },
  { href: '/admin/marketing/campaigns/automations', label: 'Automations' },
] as const;

export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionTabs items={TABS} label="Campaign sections" />
      {children}
    </>
  );
}
