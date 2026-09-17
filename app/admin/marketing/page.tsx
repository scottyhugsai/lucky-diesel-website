import { Plus } from 'lucide-react';
import { FunnelChart, ModelToggle, SourceRevenue } from '@/components/admin/marketing/core-ui/FunnelChart';
import { AssistantCard, CompliancePulseCard, NeedsYouQueue } from '@/components/admin/marketing/core-ui/OverviewPanels';
import { loadOverview } from '@/components/admin/marketing/core-ui/overview-data';
import { ButtonLink, Card, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { money } from '@/lib/format';

export const metadata = { title: 'Marketing | Lucky Diesel admin' };

function Kpi({ label, value, hint, accent = false }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-steel">{label}</p>
      <p className={`display mt-1 truncate text-4xl not-italic tabular-nums sm:text-5xl ${accent ? 'text-clover' : ''}`}>{value}</p>
      <p className="mt-0.5 text-xs text-chalk/55">{hint}</p>
    </div>
  );
}

export default async function MarketingOverviewPage({ searchParams }: { searchParams: Promise<{ model?: string | string[] }> }) {
  await requireRole('admin');
  const { model: rawModel } = await searchParams;
  const model = (Array.isArray(rawModel) ? rawModel[0] : rawModel) === 'first' ? 'first' : 'last';
  const overview = await loadOverview(model);
  const totals = overview.funnel?.totals;

  const stages = [
    { label: 'Visitors', value: overview.visitors },
    { label: 'Leads', value: totals?.leads ?? 0 },
    { label: 'Booked', value: totals?.bookings ?? 0 },
    { label: 'Paid', value: totals?.paidJobs ?? 0 },
  ];

  return (
    <>
      <PageHeader
        kicker="Marketing"
        title="What’s working"
        description="Last 90 days. Leads, bookings and revenue by source."
        actions={<ButtonLink href="/admin/marketing/campaigns/new"><Plus className="size-4" aria-hidden="true" /> New campaign</ButtonLink>}
      />

      <section aria-label="Headline numbers" className="mb-6 grid grid-cols-2 gap-x-6 gap-y-5 rounded-md border border-line bg-carbon-2 p-5 lg:grid-cols-4">
        <Kpi label="Revenue" value={money(totals?.revenueCents ?? 0, { whole: true })} hint="Paid jobs, attributed" accent />
        <Kpi label="Cost per lead" value={totals?.costPerLeadCents ? money(totals.costPerLeadCents, { whole: true }) : '—'} hint={overview.funnel?.hasSpendData ? 'From ad spend' : 'No ad spend yet'} />
        <Kpi label="ROAS" value={totals?.roas ? `${totals.roas.toFixed(1)}×` : '—'} hint="Revenue ÷ ad spend" />
        <Kpi label="Ad spend" value={money(totals?.spendCents ?? 0, { whole: true })} hint="All platforms" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-6">
          <Card title="Funnel" action={<ModelToggle model={model} />}>
            {overview.funnelError && <p role="alert" className="mb-3 text-sm text-danger">Funnel unavailable: {overview.funnelError}</p>}
            <div className="grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-start">
              <FunnelChart stages={stages} />
              <div className="min-w-0">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-steel">Revenue by source · {model} touch</h3>
                <SourceRevenue rows={overview.funnel?.rows ?? []} />
              </div>
            </div>
          </Card>
          <CompliancePulseCard pulse={overview.compliance} />
        </div>

        <div className="order-first grid min-w-0 content-start gap-6 lg:order-none">
          <section aria-labelledby="needs-heading">
            <h2 id="needs-heading" className="kicker mb-3">Needs you</h2>
            <NeedsYouQueue needs={overview.needs} />
          </section>
          <AssistantCard summary={overview.summary} />
        </div>
      </div>
    </>
  );
}
