import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge, EmptyState, PageHeader } from '@/components/app/ui';
import { NotLinked } from '@/components/portal/NotLinked';
import { requireRole } from '@/lib/auth';
import { dateOnly, money } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Invoices | Lucky Diesel' };

export default async function InvoicesPage() {
  const viewer = await requireRole('client');
  if (!viewer.customerId) return <NotLinked />;
  const supabase = await createClient();
  const [{ data: invoices }, { data: jobs }] = await Promise.all([
    supabase.from('invoices').select('id, number, status, total_cents, due_at, paid_at, created_at, work_order_id').eq('customer_id', viewer.customerId).order('created_at', { ascending: false }),
    supabase.from('work_orders').select('id, title').eq('customer_id', viewer.customerId),
  ]);
  const titleByJob = new Map((jobs ?? []).map((job) => [job.id, job.title]));
  const open = (invoices ?? []).filter((invoice) => invoice.status === 'open');
  const rest = (invoices ?? []).filter((invoice) => invoice.status !== 'open');
  const dueTotal = open.reduce((sum, invoice) => sum + invoice.total_cents, 0);

  return (
    <div>
      <PageHeader kicker="Invoices" title="Billing" description={open.length ? `${money(dueTotal)} due across ${open.length} invoice${open.length === 1 ? '' : 's'}.` : 'You’re all paid up.'} />
      {!invoices?.length && <EmptyState title="No invoices yet">Invoices show up here as soon as a job is finished.</EmptyState>}

      {open.length > 0 && (
        <ul className="mb-8 space-y-3">
          {open.map((invoice) => (
            <li key={invoice.id}>
              <Link href={`/portal/invoices/${invoice.id}`} className="group flex flex-col gap-4 rounded-md border border-clover/40 bg-clover/[0.06] p-4 transition-colors hover:border-clover sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <span className="min-w-0">
                  <span className="kicker block">Due{invoice.due_at ? ` ${dateOnly(invoice.due_at)}` : ''}</span>
                  <span className="display mt-1 block text-4xl not-italic tabular-nums">{money(invoice.total_cents)}</span>
                  <span className="mt-1 block text-sm text-chalk/65">#{invoice.number} · {titleByJob.get(invoice.work_order_id) ?? 'Service'}</span>
                </span>
                <span className="btn-go inline-flex h-12 items-center justify-center rounded-sm px-6 font-bold">Pay now</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {rest.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line bg-carbon-2">
          {rest.map((invoice) => (
            <li key={invoice.id}>
              <Link href={`/portal/invoices/${invoice.id}`} className="group flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-gunmetal/50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{titleByJob.get(invoice.work_order_id) ?? 'Service'}</span>
                  <span className="block text-sm text-steel">#{invoice.number} · {dateOnly(invoice.paid_at ?? invoice.created_at)}</span>
                </span>
                <span className="font-semibold tabular-nums">{money(invoice.total_cents)}</span>
                <Badge tone={invoice.status === 'paid' ? 'good' : 'neutral'}>{invoice.status === 'paid' ? 'Paid' : 'Void'}</Badge>
                <ChevronRight className="size-4 text-steel group-hover:text-clover" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
