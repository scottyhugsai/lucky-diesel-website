import { EventsPanel } from '@/components/admin/marketing/growth-ui/EventsPanel';
import { FleetPanel } from '@/components/admin/marketing/growth-ui/FleetPanel';
import { loadCustomerOptions, loadLoyalty, loadReferrals, loadSegments } from '@/components/admin/marketing/growth-ui/growth-data';
import { SubTabs } from '@/components/admin/marketing/growth-ui/kit';
import { LoyaltyPanel } from '@/components/admin/marketing/growth-ui/LoyaltyPanel';
import { loadEvents, loadFleets, loadOffers } from '@/components/admin/marketing/growth-ui/offers-events-data';
import { OffersPanel } from '@/components/admin/marketing/growth-ui/OffersPanel';
import { ReferralsPanel } from '@/components/admin/marketing/growth-ui/ReferralsPanel';
import { PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { siteUrl } from '@/lib/site-url';

export const metadata = { title: 'Growth | Lucky Diesel admin' };

const TABS = [
  { key: 'referrals', label: 'Referrals', blurb: 'Happy customers bring friends.' },
  { key: 'loyalty', label: 'Loyalty', blurb: 'Points and tiers for repeat trucks.' },
  { key: 'offers', label: 'Offers', blurb: 'Codes with limits and expiry.' },
  { key: 'events', label: 'Events', blurb: 'Dyno days and shop nights.' },
  { key: 'fleet', label: 'Fleet', blurb: 'Company trucks on a PM schedule.' },
] as const;
type Tab = (typeof TABS)[number]['key'];

async function TabBody({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'referrals': {
      const [data, customers] = await Promise.all([loadReferrals(), loadCustomerOptions()]);
      return <ReferralsPanel data={data} customers={customers} />;
    }
    case 'loyalty': {
      const [data, customers] = await Promise.all([loadLoyalty(), loadCustomerOptions()]);
      return <LoyaltyPanel data={data} customers={customers} />;
    }
    case 'offers': {
      const [offers, segments] = await Promise.all([loadOffers(), loadSegments()]);
      return <OffersPanel offers={offers} segments={segments} />;
    }
    case 'events': {
      const [events, segments] = await Promise.all([loadEvents(), loadSegments()]);
      return <EventsPanel events={events} segments={segments} baseUrl={siteUrl()} />;
    }
    case 'fleet': {
      const [fleets, customers] = await Promise.all([loadFleets(), loadCustomerOptions()]);
      return <FleetPanel fleets={fleets} customers={customers} />;
    }
  }
}

export default async function GrowthPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole('admin');
  const { tab: raw } = await searchParams;
  const active = TABS.find((t) => t.key === raw) ?? TABS[0];
  return (
    <>
      <PageHeader kicker="Marketing" title="Growth" description={active.blurb} />
      <SubTabs label="Growth sections" active={active.key} items={TABS.map((t) => ({ key: t.key, label: t.label, href: `/admin/marketing/growth?tab=${t.key}` }))} />
      <TabBody tab={active.key} />
    </>
  );
}
