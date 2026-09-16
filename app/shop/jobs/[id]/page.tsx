import { notFound } from 'next/navigation';
import { ClockControl, type OpenEntry } from '@/components/shop/ClockControl';
import { InspectionPanel } from '@/components/shop/InspectionPanel';
import { JobHeader } from '@/components/shop/JobHeader';
import { JobSection, SectionNav } from '@/components/shop/JobSection';
import { LineItemsPanel } from '@/components/shop/LineItemsPanel';
import { NotesPanel, PartsPanel } from '@/components/shop/NotesPartsPanel';
import { PerformancePanel } from '@/components/shop/PerformancePanel';
import { StatusActions } from '@/components/shop/StatusActions';
import { TimeOnJob } from '@/components/shop/TimeOnJob';
import { requireRole } from '@/lib/auth';
import { firstName, NEXT_STATUSES } from '@/lib/format';
import { isUuid } from '../../_lib/form';
import { engineName, truckName } from '../../_lib/labels';
import { serverNow } from '../../_lib/time';
import { loadJob } from './_data';

export const metadata = { title: 'Job | Lucky Diesel Shop' };

const CLOSED = ['invoiced', 'paid', 'cancelled'];

export default async function JobPage({ params }: PageProps<'/shop/jobs/[id]'>) {
  const viewer = await requireRole('employee', 'admin');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await loadJob(id, viewer.userId);
  if (!data) notFound();

  const now = serverNow();
  const { job } = data;
  const customerFirstName = firstName(job.customers?.full_name);
  const openEntry: OpenEntry | null = data.myOpenEntry
    ? { id: data.myOpenEntry.id, workOrderId: data.myOpenEntry.work_order_id, number: data.myOpenEntry.work_orders?.number ?? 0, startedAt: data.myOpenEntry.started_at }
    : null;
  const isClosed = CLOSED.includes(job.status);
  const openParts = data.parts.filter((part) => part.status !== 'received').length;

  const sections = [
    { id: 'inspection', label: 'Inspection', count: data.inspection?.items.length },
    { id: 'performance', label: 'Tune & dyno', count: data.dynoRuns.length + data.tunes.length || undefined },
    { id: 'notes', label: 'Notes', count: data.notes.length || undefined },
    { id: 'parts', label: 'Parts', count: openParts || undefined },
    { id: 'estimate', label: 'Estimate', count: data.lines.length || undefined },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-10">
      <div className="contents lg:grid lg:min-w-0 lg:gap-6">
        <div className="order-1 min-w-0">
          <JobHeader
            number={job.number}
            title={job.title}
            status={job.status}
            truck={truckName(job.vehicles)}
            engine={engineName(job.vehicles)}
            nickname={job.vehicles?.nickname ?? null}
            vin={job.vehicles?.vin ?? null}
            mileageIn={job.mileage_in}
            complaint={job.complaint}
            customerFirstName={customerFirstName}
            bay={job.bay}
            promisedAt={job.promised_at}
            techName={job.tech?.full_name ? firstName(job.tech.full_name) : null}
          />
        </div>

        <div className="order-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
          <SectionNav sections={sections} />
          <JobSection id="inspection" title="Inspection" kicker={data.inspection?.status === 'sent' ? 'Sent' : data.inspection ? 'Draft' : 'Not started'}>
            <InspectionPanel data={data} customerFirstName={customerFirstName} />
          </JobSection>
          <JobSection id="performance" title="Tune & dyno" kicker={truckName(job.vehicles)}>
            <PerformancePanel data={data} />
          </JobSection>
          <JobSection id="notes" title="Notes" kicker="Internal by default">
            <NotesPanel data={data} now={now} />
          </JobSection>
          <JobSection id="parts" title="Parts requests" kicker={openParts ? `${openParts} open` : 'None open'}>
            <PartsPanel data={data} now={now} />
          </JobSection>
          <JobSection id="estimate" title="Estimate" kicker="Read-only">
            <LineItemsPanel data={data} />
          </JobSection>
          <div className="h-20 lg:hidden" aria-hidden="true" />
        </div>
      </div>

      <aside className="order-2 grid content-start gap-4 lg:sticky lg:top-10 lg:order-none" aria-label="Job controls">
        <section aria-labelledby="status-heading" className="rounded-md border border-line bg-carbon-2 p-4">
          <h2 id="status-heading" className="kicker mb-3 text-sm">Move job</h2>
          <StatusActions workOrderId={job.id} number={job.number} next={NEXT_STATUSES[job.status]} textsCustomer={data.customerTextStatuses} />
        </section>
        <section aria-labelledby="time-heading" className="rounded-md border border-line bg-carbon-2 p-4">
          <h2 id="time-heading" className="kicker mb-3 text-sm">Time</h2>
          <div className="hidden lg:block">
            <ClockControl workOrderId={job.id} openEntry={openEntry} serverNow={now} disabled={isClosed} />
          </div>
          <TimeOnJob entries={data.timeEntries} userId={viewer.userId} now={now} />
        </section>
      </aside>

      <div
        className="fixed inset-x-0 z-20 border-t border-line bg-carbon/95 px-4 py-2.5 backdrop-blur-xl lg:hidden"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <ClockControl workOrderId={job.id} openEntry={openEntry} serverNow={now} compact disabled={isClosed} />
      </div>
    </div>
  );
}
