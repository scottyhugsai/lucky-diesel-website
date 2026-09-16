import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, ChevronRight, X } from 'lucide-react';
import { ButtonLink, Card, EmptyState } from '@/components/app/ui';
import { BuildSheet } from '@/components/portal/BuildSheet';
import { DynoChart } from '@/components/portal/DynoChart';
import { NotLinked } from '@/components/portal/NotLinked';
import { loadTruck } from '@/components/portal/truck';
import { requireRole } from '@/lib/auth';
import { dateOnly, money } from '@/lib/format';

export const metadata = { title: 'Truck | Lucky Diesel' };

export default async function TruckPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole('client');
  if (!viewer.customerId) return <NotLinked />;
  const { id } = await params;
  const data = await loadTruck(id, viewer.customerId);
  if (!data) notFound();
  const { vehicle, baseline, after, tunes, buildGroups, jobs, invoiceByJob } = data;
  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const specs: [string, string | null][] = [
    ['Engine', vehicle.generation ?? vehicle.engine_code],
    ['Transmission', vehicle.transmission],
    ['Mileage', vehicle.mileage ? vehicle.mileage.toLocaleString('en-US') : null],
    ['VIN', vehicle.vin],
  ];

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-md border border-line bg-carbon-2 p-4 sm:p-8">
        <div className="speed-stripes pointer-events-none absolute -right-16 -top-10 h-[140%] w-56 opacity-[0.07]" aria-hidden="true" />
        <Link href="/portal" className="relative -ml-2 inline-flex h-11 items-center gap-1.5 rounded-sm px-2 text-sm font-semibold text-steel hover:text-chalk">
          <ArrowLeft className="size-4" aria-hidden="true" /> Garage
        </Link>
        <div className="relative mt-2">
          {vehicle.nickname && <p className="kicker">“{vehicle.nickname}”</p>}
          <h1 className="display mt-2 text-5xl sm:text-7xl">{title}</h1>
          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {specs.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-widest text-steel">{label}</dt>
                <dd className={`mt-1 break-words font-semibold ${label === 'VIN' ? 'break-all font-mono text-sm' : ''}`}>{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <Card title="Dyno results" action={after ? <span className="text-sm text-steel">{dateOnly(after.run_at)}</span> : undefined}>
        {baseline && after ? (
          <div className="space-y-4">
            <DynoChart baseline={baseline} after={after} />
            <p className="text-sm text-chalk/60">
              {baseline.label} vs {after.label}
              {after.boost_psi ? ` · ${after.boost_psi} psi boost` : ''}
              {after.egt_f ? ` · ${after.egt_f}°F EGT` : ''}
            </p>
          </div>
        ) : (
          <EmptyState title="No dyno pulls yet">We record before-and-after numbers whenever we tune your truck.</EmptyState>
        )}
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card title="Tune history" padded={false}>
          {tunes.length ? (
            <ol className="divide-y divide-line">
              {tunes.map((tune) => (
                <li key={tune.id} className="px-4 py-4 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{[tune.calibrator, tune.revision].filter(Boolean).join(' · ')}</p>
                      <p className="text-sm text-steel">{[tune.tuner_platform, tune.ecu].filter(Boolean).join(' · ')}</p>
                    </div>
                    <p className="shrink-0 text-sm text-chalk/70">{dateOnly(tune.flashed_at)}</p>
                  </div>
                  <p className={`mt-2 flex items-center gap-1.5 text-sm ${tune.stock_file_backed_up ? 'text-clover' : 'text-amber-300'}`}>
                    {tune.stock_file_backed_up ? <Check className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
                    {tune.stock_file_backed_up ? 'Stock file backed up' : 'No stock file on record'}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="p-5 text-chalk/60">No tunes on record.</p>
          )}
        </Card>

        <Card title="Build sheet">
          {buildGroups.length ? <BuildSheet groups={buildGroups} /> : <p className="text-chalk/60">No parts on record yet.</p>}
        </Card>
      </div>

      <Card title="Service history" padded={false} action={<ButtonLink href="/portal/book" size="sm" variant="secondary">Book service</ButtonLink>}>
        {jobs.length ? (
          <ul className="divide-y divide-line">
            {jobs.map((job) => {
              const invoice = invoiceByJob.get(job.id);
              return (
                <li key={job.id}>
                  <Link href={`/portal/jobs/${job.id}`} className="group flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-gunmetal/50 sm:px-5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{job.title}</span>
                      <span className="block text-sm text-steel">
                        #{job.number} · {dateOnly(job.completed_at ?? job.created_at)}
                        {job.mileage_in ? ` · ${job.mileage_in.toLocaleString('en-US')} mi` : ''}
                      </span>
                    </span>
                    {invoice && <span className="font-semibold tabular-nums">{money(invoice.total_cents)}</span>}
                    <ChevronRight className="size-4 text-steel group-hover:text-clover" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="p-5 text-chalk/60">No completed jobs yet.</p>
        )}
      </Card>
    </div>
  );
}
