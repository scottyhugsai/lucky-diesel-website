import { RefreshCw } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, EmptyState, PageHeader, StatTile, TableWrap, tableClass } from '@/components/app/ui';
import { Notice, SectionTabs, SimulatedBadge } from '@/components/admin/marketing/studio/Bits';
import { DemoBanner } from '@/components/admin/marketing/studio/DemoBanner';
import { ADS_TABS } from '@/components/admin/marketing/studio/labels';
import { costPerLead, loadPerformance, roas, type PerfRow } from '@/components/admin/marketing/studio/performance-data';
import { ShareBar, SpendChart } from '@/components/admin/marketing/studio/SpendChart';
import { requireRole } from '@/lib/auth';
import { dateOnly, money, relativeTime } from '@/lib/format';
import { recentAdAlerts } from '@/lib/marketing/content/metrics-service';
import { syncNow } from './actions';

export const metadata = { title: 'Ad performance | Lucky Diesel admin' };

function PerfTable({ rows, label }: { rows: readonly PerfRow[]; label: string }) {
  if (!rows.length) return <EmptyState title="No results yet">Numbers show after the first sync.</EmptyState>;
  const max = Math.max(...rows.map((r) => r.spendCents));
  return (
    <TableWrap>
      <table className={tableClass}>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr><th scope="col">Name</th><th scope="col">Spend</th><th scope="col">Clicks</th><th scope="col">Leads</th><th scope="col">Bookings</th><th scope="col">CPL</th><th scope="col">ROAS</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const cpl = costPerLead(r);
            const ratio = roas(r);
            return (
              <tr key={r.id}>
                <td>
                  <p className="font-semibold">{r.name}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-chalk/55">{r.detail}{r.simulated && <SimulatedBadge />}</p>
                </td>
                <td className="tabular-nums">{money(r.spendCents, { whole: true })}<ShareBar value={r.spendCents} max={max} /></td>
                <td className="tabular-nums">{r.clicks.toLocaleString('en-US')}</td>
                <td className="tabular-nums">{r.leads}</td>
                <td className="tabular-nums">{r.bookings}</td>
                <td className="tabular-nums">{cpl === null ? '—' : money(cpl, { whole: true })}</td>
                <td className="tabular-nums">{ratio === null ? '—' : `${ratio.toFixed(1)}×`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableWrap>
  );
}

export default async function PerformancePage() {
  await requireRole('admin');
  const [data, alerts] = await Promise.all([loadPerformance(30), recentAdAlerts()]);
  const { totals } = data;
  const cpl = costPerLead(totals);
  const ratio = roas(totals);

  return (
    <>
      <PageHeader
        kicker="Marketing · Ads"
        title="Performance"
        description="Last 30 days, all ad platforms."
        actions={
          <ActionForm action={syncNow}>
            <PendingButton variant="secondary"><RefreshCw className="size-4" aria-hidden="true" />Sync now</PendingButton>
          </ActionForm>
        }
      />
      <SectionTabs tabs={ADS_TABS} active="/admin/marketing/ads/performance" />
      <DemoBanner platforms={['meta_ads', 'google_ads', 'tiktok_ads']} what="spend and results" />
      {totals.simulated && <Notice title="Simulated numbers">Demo campaigns produce made-up metrics. Don’t report them.</Notice>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Spend" value={money(totals.spendCents, { whole: true })} hint={totals.simulated ? 'Simulated' : undefined} />
        <StatTile label="Clicks" value={totals.clicks.toLocaleString('en-US')} />
        <StatTile label="Leads" value={totals.leads} tone="good" />
        <StatTile label="Bookings" value={totals.bookings} />
        <StatTile label="Cost / lead" value={cpl === null ? '—' : money(cpl, { whole: true })} />
        <StatTile label="ROAS" value={ratio === null ? '—' : `${ratio.toFixed(1)}×`} hint="Revenue ÷ spend" />
      </div>

      <Card title="Spend and leads by day" className="mt-6" action={totals.simulated ? <SimulatedBadge /> : undefined}>
        <SpendChart days={data.days} simulated={totals.simulated} />
      </Card>

      {alerts.length > 0 && (
        <Card title="Alerts" className="mt-6">
          <p className="mb-3 text-sm text-chalk/60">Cost-per-lead spikes, dead spend and worn-out creative.</p>
          <ul className="grid gap-2">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 rounded-sm border border-line bg-carbon px-3 py-2 text-sm">
                <span><strong>{a.campaign}</strong> — {a.message}</span>
                <span className="flex items-center gap-1.5 text-xs text-chalk/55">
                  {dateOnly(`${a.date}T12:00:00`)}
                  {a.simulated ? <SimulatedBadge /> : <Badge tone={a.sent ? 'good' : 'neutral'}>{a.sent ? 'Sent' : 'Not sent'}</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.autoPauses.length > 0 && (
        <Card title="Auto-pauses" className="mt-6">
          <ul className="grid gap-2">
            {data.autoPauses.map((p) => (
              <li key={p.name} className="flex flex-wrap justify-between gap-2 rounded-sm border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-sm">
                <span><strong>{p.name}</strong> paused: {p.reason}</span>
                <span className="text-chalk/55">{relativeTime(p.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {!data.autoPauses.length && <p className="mt-6 text-sm text-chalk/55">No auto-pauses. Caps and cost-per-lead limits are checked on every sync.</p>}

      <Card title="By campaign" className="mt-6" padded={false}><div className="p-4 sm:p-5"><PerfTable rows={data.campaigns} label="Results by campaign" /></div></Card>
      <Card title="By ad" className="mt-6" padded={false}><div className="p-4 sm:p-5"><PerfTable rows={data.creatives} label="Results by ad" /></div></Card>
    </>
  );
}
