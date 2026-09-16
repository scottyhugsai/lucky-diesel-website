import { CalendarClock, ChevronRight, ClipboardCheck, Package, Timer } from 'lucide-react';
import Link from 'next/link';
import { Badge, StatusPill } from '@/components/app/ui';
import type { Enums } from '@/lib/db/database.types';
import { dateTime } from '@/lib/format';
import { TakeJobButton } from './TakeJobButton';

export interface JobCardData {
  id: string;
  number: number;
  title: string;
  status: Enums<'work_order_status'>;
  vehicle: string;
  engine: string | null;
  customerFirstName: string;
  promisedAt: string | null;
  bay: string | null;
  openPartRequests: number;
  inspectionSent: boolean;
  techName: string | null;
  clockedIn: boolean;
}

interface JobCardProps {
  job: JobCardData;
  canTake?: boolean;
  /** Server render time, used to flag overdue promises. */
  now: number;
}

export function JobCard({ job, canTake = false, now }: JobCardProps) {
  const overdue = job.promisedAt ? new Date(job.promisedAt).getTime() < now : false;
  return (
    <article className={`group relative rounded-md border bg-carbon-2 transition-colors focus-within:border-clover hover:border-chalk/25 ${job.clockedIn ? 'border-clover/50' : 'border-line'}`}>
      {job.clockedIn && <span className="absolute inset-y-0 left-0 w-1 rounded-l-md bg-clover" aria-hidden="true" />}
      <Link href={`/shop/jobs/${job.id}`} className="block p-4 focus-visible:outline-none sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold tracking-wider text-steel">WO #{job.number}{job.bay ? ` · ${job.bay}` : ''}</p>
            <h3 className="display mt-1.5 text-[1.7rem] leading-[0.9]">{job.vehicle}</h3>
            <p className="mt-1 truncate text-sm text-chalk/70">
              {job.engine ? <span className="font-semibold text-chalk/90">{job.engine}</span> : null}
              {job.engine ? ' · ' : ''}{job.title}
            </p>
          </div>
          <ChevronRight className="mt-1 size-6 shrink-0 text-steel transition-transform group-hover:translate-x-0.5 group-hover:text-clover" aria-hidden="true" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill status={job.status} />
          {job.clockedIn && <Badge tone="good"><Timer className="size-3" aria-hidden="true" />Clocked in</Badge>}
          {job.openPartRequests > 0 && (
            <Badge tone="warn"><Package className="size-3" aria-hidden="true" />{job.openPartRequests} part{job.openPartRequests === 1 ? '' : 's'} requested</Badge>
          )}
          {job.inspectionSent && <Badge tone="violet"><ClipboardCheck className="size-3" aria-hidden="true" />Inspection sent</Badge>}
        </div>

        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-steel">Customer</dt>
            <dd className="font-semibold">{job.customerFirstName || '—'}</dd>
          </div>
          {job.promisedAt && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Promised</dt>
              <CalendarClock className={`size-4 ${overdue ? 'text-danger' : 'text-steel'}`} aria-hidden="true" />
              <dd className={overdue ? 'font-semibold text-danger' : 'font-semibold'}>{overdue ? 'Overdue · ' : ''}{dateTime(job.promisedAt)}</dd>
            </div>
          )}
          {job.techName && (
            <div className="flex gap-1.5">
              <dt className="text-steel">Tech</dt>
              <dd className="font-semibold">{job.techName}</dd>
            </div>
          )}
        </dl>
      </Link>
      {canTake && (
        <div className="border-t border-line p-3 sm:px-5">
          <TakeJobButton workOrderId={job.id} number={job.number} />
        </div>
      )}
    </article>
  );
}
