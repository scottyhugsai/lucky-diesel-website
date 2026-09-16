import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlarmClock, ArrowLeft, Mail, MessageSquare, Phone } from 'lucide-react';
import { HistoryView, MessagesView, NotesView, PartsView } from '@/components/admin/core/JobActivity';
import { JobControls } from '@/components/admin/core/JobControls';
import { InspectionView, PerformanceRecords, SignaturesView, TimeView } from '@/components/admin/core/JobRecords';
import { JobDetailsForm } from '@/components/admin/core/JobSideForms';
import { LineItemsEditor } from '@/components/admin/core/LineItemsEditor';
import { loadJobDetail } from '@/components/admin/core/job-detail-data';
import { UUID_RE } from '@/components/admin/core/parse';
import { requestNow } from '@/components/admin/core/time';
import { Avatar, Badge, Card, StatusPill, buttonClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { dateTime, vehicleLabel } from '@/lib/format';

export const metadata = { title: 'Job | Lucky Diesel Admin' };

const LOCKED = ['invoiced', 'paid', 'cancelled'];
const OPEN = ['estimate', 'awaiting_approval', 'approved', 'in_progress', 'waiting_parts', 'quality_check'];

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin');
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const detail = await loadJobDetail(id);
  if (!detail) notFound();

  const { job, lines, settings } = detail;
  const customer = job.customers;
  const vehicle = job.vehicles;
  const tech = job.profiles;
  const now = requestNow();
  const isOverdue = Boolean(job.promised_at && new Date(job.promised_at).getTime() < now && OPEN.includes(job.status));
  const billedHours = lines.filter((l) => l.kind === 'labor' && l.approval !== 'declined').reduce((sum, l) => sum + Number(l.quantity), 0);
  const smsBlocked = !customer?.sms_consent || Boolean(customer?.sms_opted_out_at);
  const contact = buttonClass('secondary', 'sm');

  return (
    <div>
      <Link href="/admin/jobs" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-chalk">
        <ArrowLeft className="size-4" aria-hidden="true" /> Jobs
      </Link>

      <header className="mb-6 grid gap-5 border-b border-line pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-3">
            <span className="kicker">WO #{job.number}</span>
            <StatusPill status={job.status} />
            {isOverdue && <Badge tone="bad"><AlarmClock className="size-3" aria-hidden="true" /> Past promised time</Badge>}
          </p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">{job.title}</h1>
          <p className="mt-3 text-lg font-semibold">
            {customer ? <Link href={`/admin/customers/${customer.id}`} className="hover:text-clover">{customer.full_name}</Link> : 'Unknown customer'}
            <span className="text-chalk/50"> · </span>
            {vehicleLabel(vehicle)}
            {vehicle?.nickname && <span className="text-chalk/50"> “{vehicle.nickname}”</span>}
          </p>
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-chalk/65">
            <div className="flex gap-1.5"><dt className="text-steel">VIN</dt><dd className="font-mono">{vehicle?.vin ?? '—'}</dd></div>
            <div className="flex items-center gap-1.5"><dt className="text-steel">Tech</dt><dd className="flex items-center gap-1.5">{tech ? <><Avatar name={tech.full_name} color={tech.avatar_color} size={20} />{tech.full_name}</> : <span className="text-amber-300">Unassigned</span>}</dd></div>
            <div className="flex gap-1.5"><dt className="text-steel">Bay</dt><dd>{job.bay ?? '—'}</dd></div>
            <div className="flex gap-1.5"><dt className="text-steel">Promised</dt><dd className={isOverdue ? 'font-bold text-danger' : ''}>{job.promised_at ? dateTime(job.promised_at) : '—'}</dd></div>
            {job.mileage_in && <div className="flex gap-1.5"><dt className="text-steel">Miles</dt><dd className="tabular-nums">{job.mileage_in.toLocaleString('en-US')}</dd></div>}
          </dl>
        </div>
        {customer && (
          <div className="flex flex-wrap gap-2">
            {customer.phone && <a href={`tel:${customer.phone.replace(/[^\d+]/g, '')}`} className={contact}><Phone className="size-4" aria-hidden="true" /> Call</a>}
            {customer.phone && (
              <a href={`sms:${customer.phone.replace(/[^\d+]/g, '')}`} className={contact} title={smsBlocked ? 'No SMS consent on file: automated texts are off' : undefined}>
                <MessageSquare className="size-4" aria-hidden="true" /> Text{smsBlocked && <span className="text-xs text-amber-300">(no consent)</span>}
              </a>
            )}
            {customer.email && <a href={`mailto:${customer.email}`} className={contact}><Mail className="size-4" aria-hidden="true" /> Email</a>}
          </div>
        )}
      </header>

      {job.complaint && (
        <p className="mb-6 rounded-md border border-line bg-carbon-2 p-4 text-chalk/80">
          <span className="kicker mr-2 text-xs">Concern</span>
          {job.complaint}
        </p>
      )}

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start">
        <div className="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-6">
          <Card title="Estimate & work" className="order-2">
            <LineItemsEditor
              workOrderId={job.id}
              lines={lines}
              locked={LOCKED.includes(job.status)}
              taxRate={settings.taxRate}
              laborRateCents={settings.laborRateCents}
              partsTaxable={settings.partsTaxable}
              laborTaxable={settings.laborTaxable}
            />
          </Card>
          <Card title="Inspection" className="order-2"><InspectionView inspection={detail.inspection} photoUrls={detail.photoUrls} /></Card>
          <Card title="Approvals & signatures" className="order-2"><SignaturesView approvals={detail.approvals} acks={detail.acks} /></Card>
          <Card title="Tune & dyno" className="order-2"><PerformanceRecords tunes={detail.tunes} dyno={detail.dyno} /></Card>
          <Card title="Messages about this job" className="order-3"><MessagesView messages={detail.messages} /></Card>
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-6">
          <Card title="Status & billing" className="order-1">
            <JobControls
              workOrderId={job.id}
              status={job.status}
              pendingLines={lines.filter((l) => l.approval === 'pending').length}
              approvedLines={lines.filter((l) => l.approval === 'approved').length}
              invoice={detail.invoice}
            />
          </Card>
          <Card title="Job details" className="order-3">
            <JobDetailsForm job={job} techs={detail.techs} bays={Array.from({ length: settings.bayCount }, (_, i) => `Bay ${i + 1}`)} />
          </Card>
          <Card title="Time" className="order-3"><TimeView time={detail.time} billedHours={billedHours} now={now} /></Card>
          <div id="parts" className="order-3 scroll-mt-24"><Card title="Parts requests"><PartsView workOrderId={job.id} parts={detail.parts} /></Card></div>
          <Card title="Notes" className="order-3"><NotesView workOrderId={job.id} notes={detail.notes} /></Card>
          <Card title="Status history" className="order-3"><HistoryView events={detail.events} /></Card>
        </div>
      </div>
    </div>
  );
}
