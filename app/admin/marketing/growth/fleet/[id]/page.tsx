import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';
import { UUID_RE } from '@/components/admin/core/parse';
import { CopyButton } from '@/components/admin/marketing/growth-ui/CopyButton';
import { Metric, shortDate, SubTabs } from '@/components/admin/marketing/growth-ui/kit';
import { Badge, Card, EmptyState, PageHeader, TableWrap, tableClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { money } from '@/lib/format';
import { daysOverdue, monthRange, previousMonth, quarterRange, TERMS_LABEL } from '@/lib/marketing/fleet/fleet-math';
import { loadFleetDetail, reportFor, reportText } from '@/lib/marketing/fleet/fleet-service';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Fleet report | Lucky Diesel admin' };

const PERIODS = [
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
] as const;

const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));

export default async function FleetReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  await requireRole('admin');
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { period: raw } = await searchParams;
  const period = PERIODS.find((p) => p.key === raw) ?? PERIODS[0];

  const now = new Date();
  const detail = await loadFleetDetail(createAdminClient(), id, now);
  if (!detail) notFound();

  const month = previousMonth(now);
  const range = period.key === 'quarter' ? quarterRange(now) : { ...monthRange(month)!, label: monthLabel(month) };
  const report = reportFor(detail, range.from, range.to, now);
  const openInvoices = detail.invoices.filter((i) => i.status === 'open');

  return (
    <>
      <Link href="/admin/marketing/growth?tab=fleet" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-chalk">
        <ArrowLeft className="size-4" aria-hidden="true" /> Fleet
      </Link>
      <PageHeader
        kicker={period.key === 'quarter' ? 'Business review' : 'Monthly report'}
        title={detail.fleet.name}
        description={range.label}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/marketing/growth/fleet/${id}/proposal`} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line px-2.5 text-xs font-semibold text-chalk/80 hover:border-clover hover:text-clover">
              <FileText className="size-3.5" aria-hidden="true" /> Proposal
            </Link>
            <CopyButton label="Copy report" value={reportText(detail, range.label, report)} />
          </div>
        }
      />
      <SubTabs
        label="Report period"
        active={period.key}
        items={PERIODS.map((p) => ({ key: p.key, label: p.label, href: `/admin/marketing/growth/fleet/${id}?period=${p.key}` }))}
      />

      {/* minmax(0,…) so the wide tables scroll inside TableWrap instead of stretching the page. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <Card title="Period">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Units" value={report.unitsServiced} />
            <Metric label="Jobs" value={report.jobs} />
            <Metric label="Spend" value={money(report.spendCents)} />
            <Metric label="In shop" value={report.avgDowntimeDays === null ? '—' : `${report.avgDowntimeDays}d`} />
          </div>
        </Card>

        <Card title="Balance" className="min-w-0">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Metric label="Open" value={money(report.openBalanceCents)} />
            <Metric label="Past due" value={money(report.overdueCents)} tone={report.overdueCents > 0 ? 'bad' : 'good'} />
            <Metric label="Terms" value={<span className="text-base">{TERMS_LABEL[detail.fleet.billing_terms as keyof typeof TERMS_LABEL] ?? detail.fleet.billing_terms}</span>} />
          </div>
          {openInvoices.length > 0 && (
            <TableWrap>
              <table className={`${tableClass} mt-4`}>
                <thead><tr><th>Invoice</th><th>Due</th><th>Late</th><th>Total</th></tr></thead>
                <tbody>
                  {openInvoices.slice(0, 12).map((i) => {
                    const late = daysOverdue(i.dueAt, now);
                    return (
                      <tr key={i.id}>
                        <td><Link href={`/admin/invoices/${i.id}`} className="font-semibold hover:text-clover">#{i.number}</Link></td>
                        <td className="text-chalk/75">{shortDate(i.dueAt)}</td>
                        <td>{late > 0 ? <Badge tone="warn">{late}d</Badge> : <span className="text-steel">—</span>}</td>
                        <td className="font-mono tabular-nums">{money(i.totalCents)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>

        <Card title="Due for PM">
          {report.dueSoon.length === 0 ? (
            <EmptyState title="Nothing due">No units due in the next 30 days.</EmptyState>
          ) : (
            <ul className="grid gap-px bg-line sm:grid-cols-2">
              {report.dueSoon.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 bg-carbon-2 px-4 py-3 text-sm">
                  <span className="min-w-0 truncate font-semibold">{t.label}</span>
                  <span className={`shrink-0 font-mono text-xs ${t.overdue ? 'text-amber-300' : 'text-clover'}`}>{t.nextDue ? shortDate(t.nextDue) : 'No history'}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Trucks" className="min-w-0">
          {detail.trucks.length === 0 ? (
            <EmptyState title="No trucks linked">Link a customer from the Fleet tab.</EmptyState>
          ) : (
            <TableWrap>
              <table className={tableClass}>
                <thead><tr><th>Truck</th><th>Owner</th><th>Last</th><th>Next</th></tr></thead>
                <tbody>
                  {detail.trucks.map((t) => (
                    <tr key={t.id}>
                      <td className="font-semibold">{t.label}</td>
                      <td className="text-chalk/75">{t.owner}</td>
                      <td className="text-chalk/75">{shortDate(t.lastService)}</td>
                      <td className={t.overdue ? 'text-amber-300' : 'text-clover'}>{t.nextDue ? shortDate(t.nextDue) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>
    </>
  );
}
