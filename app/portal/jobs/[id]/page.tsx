import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card, StatusPill } from '@/components/app/ui';
import { AcknowledgementForm } from '@/components/portal/AcknowledgementForm';
import { EstimateApproval } from '@/components/portal/EstimateApproval';
import { InspectionReport, InspectionSummary } from '@/components/portal/InspectionReport';
import { JobProgress } from '@/components/portal/JobProgress';
import { JobSidebar } from '@/components/portal/JobSidebar';
import { LineSummary, TotalsRows } from '@/components/portal/LineSummary';
import { NotLinked } from '@/components/portal/NotLinked';
import { AcknowledgementRecord, ApprovalRecord } from '@/components/portal/SignedRecords';
import { loadJob } from '@/components/portal/job';
import { requireRole } from '@/lib/auth';
import { vehicleLabel } from '@/lib/format';
import { computeTotals } from '@/lib/work-orders/totals';

export const metadata = { title: 'Job | Lucky Diesel' };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole('client');
  if (!viewer.customerId) return <NotLinked />;
  const { id } = await params;
  const data = await loadJob(id, viewer.customerId);
  if (!data) notFound();
  const { job, vehicle, lines, groups, inspection } = data;

  const pending = lines.some((line) => line.approval === 'pending');
  const approving = job.status === 'awaiting_approval' && pending;
  const closed = job.status === 'paid' || job.status === 'cancelled';
  const showAck = data.needsAck && (data.acknowledgement || (!closed && job.status !== 'estimate'));
  const visibleLines = lines.filter((line) => line.approval !== 'declined');
  const totals = computeTotals(visibleLines, data.taxRate);
  const inspectionProps = { summary: inspection?.summary ?? null, sentAt: inspection?.sent_at ?? null, techName: data.techName, groups };

  return (
    <div className="space-y-8">
      <header>
        <Link href="/portal/jobs" className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-sm px-2 text-sm font-semibold text-steel hover:text-chalk">
          <ArrowLeft className="size-4" aria-hidden="true" /> All jobs
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="kicker">Job #{job.number}{vehicle?.nickname ? ` · ${vehicle.nickname}` : ''}</p>
            <h1 className="display mt-2 text-4xl sm:text-6xl">{job.title}</h1>
            <p className="mt-2 text-chalk/65">{vehicleLabel(vehicle)}</p>
          </div>
          <StatusPill status={job.status} customer />
        </div>
        {job.status !== 'cancelled' && <JobProgress status={job.status} className="mt-6" />}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {approving ? (
            <EstimateApproval
              workOrderId={job.id}
              groups={groups}
              otherLines={data.otherLines}
              taxRate={data.taxRate}
              summary={inspection ? <InspectionSummary {...inspectionProps} /> : null}
            />
          ) : (
            <>
              {data.approval && <ApprovalRecord approval={data.approval} />}
              {inspection && <InspectionReport {...inspectionProps} />}
              {data.otherLines.length > 0 && (
                <Card title={inspection ? 'Parts & labor' : 'Work items'} padded={false}>
                  <div className="divide-y divide-line">
                    {data.otherLines.map((line) => <LineSummary key={line.id} line={line} />)}
                  </div>
                </Card>
              )}
              {visibleLines.length > 0 && (
                <div className="rounded-md border border-line bg-carbon-2 p-4 sm:p-5">
                  <TotalsRows subtotal={totals.subtotalCents} tax={totals.taxCents} total={totals.totalCents} taxLabel="Tax (parts)" />
                  {data.lines.length !== visibleLines.length && <p className="mt-2 text-xs text-steel">Declined items are not included.</p>}
                </div>
              )}
            </>
          )}

          {showAck && vehicle && (
            <section id="acknowledgement" aria-labelledby="ack-title" className="scroll-mt-20 rounded-md border border-line bg-carbon-2 p-4 sm:p-6">
              <p className="kicker">Before we start</p>
              <h2 id="ack-title" className="display mt-2 text-3xl sm:text-4xl">Performance &amp; emissions acknowledgement</h2>
              <p className="mt-2 max-w-2xl text-chalk/70">
                This job includes tuning, exhaust or turbo work. Please read and sign so we both have a record of the work and how the truck will be used.
              </p>
              <div className="mt-5">
                {data.acknowledgement ? (
                  <AcknowledgementRecord acknowledgement={data.acknowledgement} />
                ) : (
                  <AcknowledgementForm
                    workOrderId={job.id}
                    subject={{ vehicle: vehicleLabel(vehicle), vin: vehicle.vin, jobNumber: job.number, jobTitle: job.title, items: data.ackItems }}
                  />
                )}
              </div>
            </section>
          )}

          {data.jobPhotos.length > 0 && (
            <Card title="Photos">
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.jobPhotos.map((photo) => (
                  <li key={photo.id}>
                    <a href={photo.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-sm border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Supabase URL; remote patterns aren't configured */}
                      <img src={photo.url} alt={photo.caption ?? 'Job photo'} width={480} height={360} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                    </a>
                    {photo.caption && <p className="mt-1 text-xs text-chalk/55">{photo.caption}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <JobSidebar job={job} techName={data.techName} invoice={data.invoice} notes={data.notes} events={data.events} />
      </div>
    </div>
  );
}
