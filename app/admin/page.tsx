import { Plus } from 'lucide-react';
import { BarList, ColumnChart } from '@/components/admin/core/charts';
import { loadDashboard } from '@/components/admin/core/dashboard-data';
import { ActivityFeed, AttentionList, KpiGrid, TodayStrip, compactMoney } from '@/components/admin/core/dashboard-sections';
import { ButtonLink, Card } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { money } from '@/lib/format';

export const metadata = { title: 'Dashboard | Lucky Diesel Admin' };

const TODAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' });

export default async function AdminDashboard() {
  await requireRole('admin');
  const data = await loadDashboard();

  const weeklyTotal = data.weekly.reduce((sum, w) => sum + w.value, 0);
  const serviceTotal = data.byService.reduce((sum, s) => sum + s.value, 0);
  const [newLeads, , , won] = data.funnel;
  const winRate = newLeads && newLeads.value ? Math.round(((won?.value ?? 0) / newLeads.value) * 100) : 0;

  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">{TODAY_FORMAT.format(new Date())}</p>
          <h1 className="display mt-2 text-4xl sm:text-6xl">Today at the shop</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/customers/new" variant="secondary">New customer</ButtonLink>
          <ButtonLink href="/admin/jobs/new">
            <Plus className="size-4" aria-hidden="true" />
            New job
          </ButtonLink>
        </div>
      </header>

      <TodayStrip today={data.today} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card title={<span className="flex items-center gap-2">Needs attention {data.attention.length > 0 && <span className="grid min-w-6 place-items-center rounded-full bg-clover px-1.5 text-sm not-italic text-carbon">{data.attention.length}</span>}</span>}>
          <AttentionList items={data.attention} />
        </Card>
        <Card title="Shop floor feed">
          <ActivityFeed events={data.events} />
        </Card>
      </div>

      <section aria-labelledby="kpi-heading" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="kpi-heading" className="display text-3xl">The numbers</h2>
          <p className="text-sm text-steel">Last 30 days vs the 30 before</p>
        </div>
        <KpiGrid kpis={data.kpis} />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="Weekly revenue" action={<span className="text-sm text-steel">8 wks · {money(weeklyTotal, { whole: true })}</span>}>
          <ColumnChart
            data={data.weekly}
            format={compactMoney}
            ariaLabel={`Weekly revenue for the last 8 weeks: ${data.weekly.map((w) => `week of ${w.label} ${money(w.value, { whole: true })}`).join(', ')}.`}
          />
          <p className="mt-3 text-xs text-steel">Dashed line: 8-week average ({money(weeklyTotal / 8, { whole: true })}). Brightest bar is this week.</p>
        </Card>
        <Card className="lg:col-span-2" title="Revenue by service" action={<span className="text-sm text-steel">90 days</span>}>
          {data.byService.length ? (
            <BarList
              data={data.byService}
              format={compactMoney}
              secondary={(d) => (serviceTotal ? `${Math.round((d.value / serviceTotal) * 100)}%` : null)}
              ariaLabel={`Revenue by service type, last 90 days: ${data.byService.map((s) => `${s.label} ${money(s.value, { whole: true })}`).join(', ')}.`}
            />
          ) : (
            <p className="text-sm text-steel">No payments in the last 90 days.</p>
          )}
        </Card>
      </div>

      <Card title="Lead funnel" action={<span className="text-sm text-steel">90 days · {winRate}% won</span>}>
        <BarList
          data={data.funnel}
          format={(v) => String(v)}
          secondary={(d, index) => (index === 0 || !data.funnel[index - 1]?.value ? null : `${Math.round((d.value / data.funnel[index - 1]!.value) * 100)}%`)}
          ariaLabel={`Lead funnel, last 90 days: ${data.funnel.map((f) => `${f.label} ${f.value}`).join(', ')}.`}
        />
        <p className="mt-3 text-xs text-steel">Leads that reached each stage. Percent is conversion from the stage before.</p>
      </Card>
    </div>
  );
}
