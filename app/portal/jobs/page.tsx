import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ButtonLink, EmptyState, PageHeader, StatusPill } from '@/components/app/ui';
import { JobProgress } from '@/components/portal/JobProgress';
import { NotLinked } from '@/components/portal/NotLinked';
import { requireRole } from '@/lib/auth';
import { dateOnly, money, vehicleLabel } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Jobs | Lucky Diesel' };

export default async function JobsPage() {
  const viewer = await requireRole('client');
  if (!viewer.customerId) return <NotLinked />;
  const supabase = await createClient();
  const [{ data: jobs }, { data: vehicles }, { data: invoices }] = await Promise.all([
    supabase.from('work_orders').select('id, number, title, status, vehicle_id, created_at, completed_at').eq('customer_id', viewer.customerId).order('created_at', { ascending: false }),
    supabase.from('vehicles').select('id, year, make, model, engine_code, nickname').eq('customer_id', viewer.customerId),
    supabase.from('invoices').select('work_order_id, total_cents').eq('customer_id', viewer.customerId),
  ]);
  const vehicleById = new Map((vehicles ?? []).map((v) => [v.id, v]));
  const totalByJob = new Map((invoices ?? []).map((i) => [i.work_order_id, i.total_cents]));
  const active = (jobs ?? []).filter((job) => job.status !== 'paid');
  const history = (jobs ?? []).filter((job) => job.status === 'paid');

  return (
    <div>
      <PageHeader kicker="Jobs" title="Your work orders" description="Live status for work in the shop, and every job we’ve done on your trucks." />
      {!jobs?.length && (
        <EmptyState title="No jobs yet" action={<ButtonLink href="/portal/book">Book service</ButtonLink>}>
          When your truck checks in, you can follow every step here.
        </EmptyState>
      )}

      {active.length > 0 && (
        <section aria-labelledby="active-jobs" className="mb-10">
          <h2 id="active-jobs" className="mb-3 text-xs font-semibold uppercase tracking-widest text-steel">In progress</h2>
          <ul className="space-y-3">
            {active.map((job) => (
              <li key={job.id}>
                <Link href={`/portal/jobs/${job.id}`} className="group block rounded-md border border-line bg-carbon-2 p-4 transition-colors hover:border-clover/50 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-steel">#{job.number} · {vehicleLabel(vehicleById.get(job.vehicle_id))}</p>
                      <p className="display mt-1 text-2xl not-italic sm:text-3xl">{job.title}</p>
                    </div>
                    <StatusPill status={job.status} customer />
                  </div>
                  <JobProgress status={job.status} className="mt-4" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section aria-labelledby="job-history">
          <h2 id="job-history" className="mb-3 text-xs font-semibold uppercase tracking-widest text-steel">History</h2>
          <ul className="divide-y divide-line rounded-md border border-line bg-carbon-2">
            {history.map((job) => (
              <li key={job.id}>
                <Link href={`/portal/jobs/${job.id}`} className="group flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-gunmetal/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{job.title}</span>
                    <span className="block text-sm text-steel">#{job.number} · {dateOnly(job.completed_at ?? job.created_at)}</span>
                  </span>
                  {totalByJob.has(job.id) && <span className="font-semibold tabular-nums">{money(totalByJob.get(job.id))}</span>}
                  <ChevronRight className="size-4 text-steel group-hover:text-clover" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
