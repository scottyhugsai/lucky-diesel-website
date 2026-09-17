import { Card, EmptyState, tableClass, TableWrap } from '@/components/app/ui';
import { money } from '@/lib/format';
import type { CohortRow, LtvRow, RetentionReport, SpeedReport } from '@/lib/marketing/core/analytics-reports';
import type { FunnelRow } from '@/lib/marketing/core/analytics';
import { pct, sourceLabel } from './labels';

/* Read-only report panels for /admin/marketing/reports. */

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-widest text-steel">{label}</dt>
      <dd className="display mt-1 text-3xl not-italic tabular-nums">{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-chalk/55">{hint}</p>}
    </div>
  );
}

const minutes = (value: number | null): string => {
  if (value === null) return '—';
  if (value < 90) return `${Math.round(value)} min`;
  if (value < 1440) return `${(value / 60).toFixed(1)} hr`;
  return `${(value / 1440).toFixed(1)} days`;
};

/** Source rows with gross-profit ROAS alongside revenue ROAS. */
export function ProfitTable({ rows }: { rows: readonly FunnelRow[] }) {
  const visible = rows.filter((r) => r.revenueCents || r.spendCents || r.leads).slice(0, 12);
  if (!visible.length) return <EmptyState title="No attributed revenue yet">Numbers appear as jobs are paid.</EmptyState>;
  return (
    <TableWrap>
      <table className={tableClass}>
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col" className="text-right">Revenue</th>
            <th scope="col" className="text-right">Gross profit</th>
            <th scope="col" className="text-right">Spend</th>
            <th scope="col" className="text-right">ROAS</th>
            <th scope="col" className="text-right">GP ROAS</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.source}>
              <th scope="row" className="font-semibold">{sourceLabel(row.source)}</th>
              <td className="text-right tabular-nums">{money(row.revenueCents, { whole: true })}</td>
              <td className="text-right tabular-nums">{money(row.profitCents, { whole: true })}</td>
              <td className="text-right tabular-nums">{row.spendCents ? money(row.spendCents, { whole: true }) : '—'}</td>
              <td className="text-right tabular-nums">{row.roas === null ? '—' : `${row.roas.toFixed(1)}×`}</td>
              <td className={`text-right font-bold tabular-nums ${row.profitRoas !== null && row.profitRoas >= 2 ? 'text-clover' : ''}`}>
                {row.profitRoas === null ? '—' : `${row.profitRoas.toFixed(1)}×`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

export function LtvCard({ rows }: { rows: readonly LtvRow[] }) {
  const visible = rows.filter((r) => r.paying > 0).slice(0, 10);
  return (
    <Card title="Lifetime value by source" padded={Boolean(!visible.length)}>
      {!visible.length ? (
        <EmptyState title="No paid customers yet">Value per customer shows once invoices are paid.</EmptyState>
      ) : (
        <TableWrap>
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col" className="text-right">Customers</th>
                <th scope="col" className="text-right">Paying</th>
                <th scope="col" className="text-right">Lifetime value</th>
                <th scope="col" className="text-right">Repeat</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.source}>
                  <th scope="row" className="font-semibold">{sourceLabel(row.source)}</th>
                  <td className="text-right tabular-nums">{row.customers}</td>
                  <td className="text-right tabular-nums">{row.paying}</td>
                  <td className="text-right font-bold tabular-nums">{row.ltvCents === null ? '—' : money(row.ltvCents, { whole: true })}</td>
                  <td className="text-right tabular-nums">{pct(row.repeatRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </Card>
  );
}

export function SpeedCard({ report }: { report: SpeedReport | null }) {
  if (!report || !report.leads) {
    return <Card title="Speed to lead"><EmptyState title="No leads in this window">First-reply time appears with new leads.</EmptyState></Card>;
  }
  return (
    <Card title="Speed to lead">
      <dl className="grid grid-cols-3 gap-4">
        <Figure label="Median reply" value={minutes(report.medianMinutes)} hint={`${report.responded} of ${report.leads} answered`} />
        <Figure label="Under 5 min" value={pct(report.within5Rate)} hint="Best booking odds" />
        <Figure label="Leads" value={String(report.leads)} hint="Last 90 days" />
      </dl>
      <TableWrap>
        <table className={`${tableClass} mt-4`}>
          <thead>
            <tr>
              <th scope="col">Reply time</th>
              <th scope="col" className="text-right">Leads</th>
              <th scope="col" className="text-right">Booked</th>
              <th scope="col" className="text-right">Rate</th>
            </tr>
          </thead>
          <tbody>
            {report.buckets.filter((b) => b.leads > 0).map((b) => (
              <tr key={b.label}>
                <th scope="row" className="font-semibold">{b.label}</th>
                <td className="text-right tabular-nums">{b.leads}</td>
                <td className="text-right tabular-nums">{b.booked}</td>
                <td className="text-right font-bold tabular-nums">{pct(b.bookingRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}

export function RetentionCard({ report, reminders }: { report: RetentionReport | null; reminders: { sent: number; booked: number; rate: number | null } }) {
  if (!report || !report.customers) {
    return <Card title="Retention"><EmptyState title="No paid history yet">Return rates appear after repeat visits.</EmptyState></Card>;
  }
  return (
    <Card title="Retention">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Figure label="Returning" value={pct(report.returningRate)} hint={`${report.returning} of ${report.customers}`} />
        <Figure label="Between visits" value={report.medianDaysBetween === null ? '—' : `${report.medianDaysBetween} days`} hint="Median gap" />
        <Figure label="Kept 12 mo" value={pct(report.retained12mRate)} hint="Back within a year" />
        <Figure label="Lapsed" value={String(report.lapsed)} hint="No visit in a year" />
        <Figure label="Reminders sent" value={String(reminders.sent)} hint="Service due, 180 days" />
        <Figure label="Reminder booked" value={pct(reminders.rate)} hint={`${reminders.booked} booked after`} />
      </dl>
    </Card>
  );
}

export function CohortCard({ rows }: { rows: readonly CohortRow[] }) {
  const width = rows[0]?.cells.length ?? 0;
  if (!rows.length || !width) return null;
  const shade = (value: number | null) => (value === null ? 'bg-carbon text-steel' : value >= 0.5 ? 'bg-clover text-carbon' : value >= 0.25 ? 'bg-clover/50' : value > 0 ? 'bg-clover/20' : 'bg-carbon text-steel');
  return (
    <Card title="Cohorts" action={<span className="text-xs text-steel">Repeat visits by first month</span>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="text-[0.68rem] uppercase tracking-widest text-steel">
              <th scope="col" className="pb-2 font-semibold">Cohort</th>
              <th scope="col" className="pb-2 text-right font-semibold">Size</th>
              {Array.from({ length: width }, (_, k) => (
                <th key={k} scope="col" className="pb-2 text-center font-semibold">+{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cohort} className="border-t border-line">
                <th scope="row" className="py-1.5 pr-2 font-semibold">{row.cohort}</th>
                <td className="py-1.5 pr-2 text-right tabular-nums">{row.size}</td>
                {row.cells.map((cell, k) => (
                  <td key={k} className="px-0.5 py-1.5">
                    <span className={`block rounded-sm py-1 text-center text-xs font-bold tabular-nums ${shade(cell)}`}>{cell === null ? '' : cell === 0 ? '·' : pct(cell)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
