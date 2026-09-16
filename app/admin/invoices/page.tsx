import Link from 'next/link';
import { EmptyState, PageHeader, TableWrap, tableClass } from '@/components/app/ui';
import { ageLabel, requestNow } from '@/components/admin/core/time';
import { requireRole } from '@/lib/auth';
import { dateOnly, money, vehicleLabel } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Invoices | Lucky Diesel Admin' };

const TABS = [
  { key: 'open', label: 'Open' },
  { key: 'paid', label: 'Paid' },
  { key: 'all', label: 'All' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requireRole('admin');
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : 'open';

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('id, number, status, total_cents, created_at, due_at, paid_at, customers(id, full_name), work_orders(id, number, vehicles(year, make, model, engine_code))')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw new Error(`Could not load invoices: ${error.message}`);

  const all = data ?? [];
  const now = requestNow();
  const byTab: Record<Tab, typeof all> = {
    open: all.filter((i) => i.status === 'open'),
    paid: all.filter((i) => i.status === 'paid'),
    all,
  };
  const sum = (rows: typeof all) => rows.reduce((total, i) => total + i.total_cents, 0);
  const rows = byTab[tab];
  const overdueCount = byTab.open.filter((i) => i.due_at && new Date(i.due_at).getTime() < now).length;

  return (
    <div>
      <PageHeader
        kicker="Money"
        title="Invoices"
        description={
          <>
            {money(sum(byTab.open))} outstanding across {byTab.open.length} invoice{byTab.open.length === 1 ? '' : 's'}
            {overdueCount > 0 && <span className="font-semibold text-danger"> · {overdueCount} overdue</span>}
          </>
        }
      />

      <nav aria-label="Invoice status" className="mb-5 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line sm:inline-grid sm:min-w-[32rem]">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link key={t.key} href={`/admin/invoices?tab=${t.key}`} aria-current={active ? 'page' : undefined} className={`relative px-4 py-3 transition-colors ${active ? 'bg-gunmetal' : 'bg-carbon-2 hover:bg-gunmetal/60'}`}>
              <span className={`block text-xs font-semibold uppercase tracking-widest ${active ? 'text-clover' : 'text-steel'}`}>{t.label} · {byTab[t.key].length}</span>
              <span className="display mt-1 block text-2xl not-italic tabular-nums">{money(sum(byTab[t.key]), { whole: true })}</span>
              {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-clover" aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>

      {rows.length ? (
        <TableWrap>
          <table className={`${tableClass} min-w-[760px]`}>
            <thead>
              <tr>
                <th scope="col">Invoice</th>
                <th scope="col">Customer &amp; truck</th>
                <th scope="col">Status</th>
                <th scope="col">Issued</th>
                <th scope="col">Age</th>
                <th scope="col" className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const overdue = inv.status === 'open' && Boolean(inv.due_at && new Date(inv.due_at).getTime() < now);
                return (
                  <tr key={inv.id} className={`hover:bg-gunmetal/50 ${overdue ? 'bg-danger/5' : ''}`}>
                    <td>
                      <Link href={`/admin/invoices/${inv.id}`} className="display text-lg not-italic text-clover hover:underline">#{inv.number}</Link>
                      {inv.work_orders && <span className="block text-xs text-steel">WO #{inv.work_orders.number}</span>}
                    </td>
                    <td>
                      <span className="block font-semibold">{inv.customers?.full_name ?? '—'}</span>
                      <span className="block text-xs text-steel">{vehicleLabel(inv.work_orders?.vehicles)}</span>
                    </td>
                    <td>
                      <span className={`text-xs font-bold uppercase tracking-wider ${inv.status === 'paid' ? 'text-clover' : overdue ? 'text-danger' : inv.status === 'void' ? 'text-steel' : 'text-amber-300'}`}>
                        {overdue ? 'Overdue' : inv.status}
                      </span>
                      {inv.paid_at && <span className="block text-xs text-steel">{dateOnly(inv.paid_at)}</span>}
                      {inv.status === 'open' && inv.due_at && <span className="block text-xs text-steel">due {dateOnly(inv.due_at)}</span>}
                    </td>
                    <td className="text-chalk/70">{dateOnly(inv.created_at)}</td>
                    <td className={`tabular-nums ${overdue ? 'font-bold text-danger' : 'text-steel'}`}>{inv.status === 'open' ? ageLabel(inv.created_at, now) : '—'}</td>
                    <td className="text-right font-bold tabular-nums">{money(inv.total_cents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <EmptyState title={tab === 'open' ? 'Nothing outstanding' : 'No invoices'}>
          {tab === 'open' ? 'Every invoice is paid. Nice.' : 'Invoices are created from a finished job.'}
        </EmptyState>
      )}
    </div>
  );
}
