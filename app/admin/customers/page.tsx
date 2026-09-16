import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { SmsBadge } from '@/components/admin/core/CustomerPanels';
import { loadCustomers, searchCustomers } from '@/components/admin/core/customers-data';
import { Badge, ButtonLink, EmptyState, PageHeader, TableWrap, buttonClass, fieldClass, tableClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { dateOnly, money } from '@/lib/format';

export const metadata = { title: 'Customers | Lucky Diesel Admin' };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  await requireRole('admin');
  const { q: rawQ } = await searchParams;
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ)?.slice(0, 80) ?? '';

  const all = await loadCustomers();
  const customers = searchCustomers(all, q).sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''));
  const lifetime = all.reduce((sum, c) => sum + c.lifetimeCents, 0);
  const consented = all.filter((c) => c.smsStatus === 'consented').length;

  return (
    <div>
      <PageHeader
        kicker="People & trucks"
        title="Customers"
        description={`${all.length} customers · ${money(lifetime, { whole: true })} lifetime revenue · ${consented} accept texts`}
        actions={<ButtonLink href="/admin/customers/new"><Plus className="size-4" aria-hidden="true" /> New customer</ButtonLink>}
      />

      <form role="search" action="/admin/customers" className="mb-5 flex max-w-xl gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search customers</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-steel" aria-hidden="true" />
          <input name="q" type="search" defaultValue={q} placeholder="Name, phone, email or VIN" className={`${fieldClass} pl-9`} />
        </label>
        <button type="submit" className={buttonClass('secondary')}>Search</button>
      </form>

      {q && (
        <p className="mb-3 text-sm text-steel" aria-live="polite">
          {customers.length} match{customers.length === 1 ? '' : 'es'} for “{q}” · <Link href="/admin/customers" className="text-clover hover:underline">Clear</Link>
        </p>
      )}

      {customers.length ? (
        <TableWrap>
          <table className={`${tableClass} min-w-[820px]`}>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Trucks</th>
                <th scope="col" className="text-right">Lifetime</th>
                <th scope="col">Last visit</th>
                <th scope="col">Texts</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-gunmetal/50">
                  <td>
                    <Link href={`/admin/customers/${c.id}`} className="font-semibold hover:text-clover">{c.fullName}</Link>
                    {c.hasPortal && <Badge tone="violet" className="ml-2 !py-0 text-[0.65rem]">Portal</Badge>}
                    <span className="block text-xs text-steel">{[c.phone, c.email].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td>
                    <span className="font-semibold tabular-nums">{c.trucks.length}</span>
                    {c.trucks[0] && <span className="ml-2 text-chalk/65">{c.trucks[0]}{c.trucks.length > 1 ? ` +${c.trucks.length - 1}` : ''}</span>}
                  </td>
                  <td className="text-right tabular-nums">
                    <span className="font-bold">{money(c.lifetimeCents, { whole: true })}</span>
                    {c.openCents > 0 && <span className="block text-xs text-amber-300">{money(c.openCents, { whole: true })} open</span>}
                  </td>
                  <td className="text-chalk/70">{c.lastVisit ? dateOnly(c.lastVisit) : <span className="text-steel">Never</span>}</td>
                  <td><SmsBadge status={c.smsStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <EmptyState title={q ? 'No customers match' : 'No customers yet'} action={<ButtonLink href="/admin/customers/new">Add a customer</ButtonLink>}>
          {q ? 'Try part of a name, the last 4 of a phone number, or a VIN.' : 'Customers from the website land here automatically.'}
        </EmptyState>
      )}
    </div>
  );
}
