import Link from 'next/link';
import { AlarmClock } from 'lucide-react';
import { Avatar, EmptyState, StatusPill, TableWrap, tableClass } from '@/components/app/ui';
import { dateTime, money } from '@/lib/format';
import { BOARD_COLUMNS, type JobSummary } from './jobs-data';
import { ageLabel } from './time';

function Promised({ job, compact = false }: { job: JobSummary; compact?: boolean }) {
  if (!job.promisedAt) return <span className="text-steel">No promise time</span>;
  return (
    <span className={`inline-flex items-center gap-1 ${job.isOverdue ? 'font-bold text-danger' : 'text-chalk/70'}`}>
      <AlarmClock className="size-3.5 shrink-0" aria-hidden="true" />
      {job.isOverdue && !compact ? 'Overdue · ' : ''}
      {dateTime(job.promisedAt)}
    </span>
  );
}

export function JobCard({ job }: { job: JobSummary }) {
  return (
    <Link
      href={`/admin/jobs/${job.id}`}
      className={`group block rounded-sm border bg-carbon p-3 transition-colors hover:border-clover/60 hover:bg-gunmetal/60 ${job.isOverdue ? 'border-danger/50' : 'border-line'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="display text-lg not-italic leading-none text-clover">#{job.number}</span>
        <span className="text-xs font-semibold tabular-nums text-steel" title="Age since opened">{ageLabel(job.createdAt)}</span>
      </div>
      <p className="mt-2 line-clamp-2 font-semibold leading-snug">{job.truck}</p>
      <p className="mt-0.5 truncate text-sm text-chalk/60">{job.customerName}</p>
      <p className="mt-0.5 truncate text-xs text-steel">{job.title}</p>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
        {job.tech ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-chalk/70">
            <Avatar name={job.tech.name} color={job.tech.color} size={22} />
            <span className="truncate">{job.tech.name.split(' ')[0]}</span>
          </span>
        ) : (
          <span className="text-xs font-semibold text-amber-300">Unassigned</span>
        )}
        <span className="font-bold tabular-nums">{money(job.totalCents, { whole: true })}</span>
      </div>
      <p className="mt-2 text-xs">
        <Promised job={job} compact />
      </p>
    </Link>
  );
}

export function JobBoard({ jobs }: { jobs: JobSummary[] }) {
  return (
    <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-3 sm:mx-0 sm:px-0" role="region" aria-label="Job board" tabIndex={0}>
      <ol className="flex snap-x snap-mandatory gap-3">
        {BOARD_COLUMNS.map((column) => {
          const items = jobs.filter((job) => column.statuses.includes(job.status));
          const total = items.reduce((sum, job) => sum + job.totalCents, 0);
          return (
            <li key={column.key} className="flex w-[17rem] shrink-0 snap-start flex-col rounded-md border border-line bg-carbon-2">
              <div className="flex items-baseline justify-between gap-2 border-b border-line px-3 py-2.5">
                <h2 className="display text-lg not-italic">
                  {column.label} <span className="text-steel">{items.length}</span>
                </h2>
                <span className="text-xs font-semibold tabular-nums text-steel">{money(total, { whole: true })}</span>
              </div>
              <ul className="flex flex-1 flex-col gap-2 p-2">
                {items.length ? (
                  items.map((job) => (
                    <li key={job.id}>
                      <JobCard job={job} />
                    </li>
                  ))
                ) : (
                  <li className="grid flex-1 place-items-center rounded-sm border border-dashed border-line px-3 py-8 text-center text-xs text-steel">Nothing here</li>
                )}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function JobTable({ jobs }: { jobs: JobSummary[] }) {
  if (!jobs.length) return <EmptyState title="No jobs match">Try a different search or status.</EmptyState>;
  return (
    <TableWrap>
      <table className={`${tableClass} min-w-[860px]`}>
        <thead>
          <tr>
            <th scope="col">WO</th>
            <th scope="col">Customer &amp; truck</th>
            <th scope="col">Status</th>
            <th scope="col">Tech</th>
            <th scope="col">Promised</th>
            <th scope="col">Age</th>
            <th scope="col" className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className={`hover:bg-gunmetal/50 ${job.isOverdue ? 'bg-danger/5' : ''}`}>
              <td>
                <Link href={`/admin/jobs/${job.id}`} className="display text-lg not-italic text-clover hover:underline">
                  #{job.number}
                </Link>
              </td>
              <td>
                <Link href={`/admin/jobs/${job.id}`} className="block font-semibold hover:text-clover">{job.customerName}</Link>
                <span className="block text-xs text-steel">{job.truck} · {job.title}</span>
              </td>
              <td><StatusPill status={job.status} /></td>
              <td>
                {job.tech ? (
                  <span className="flex items-center gap-2"><Avatar name={job.tech.name} color={job.tech.color} size={24} />{job.tech.name}</span>
                ) : (
                  <span className="text-amber-300">Unassigned</span>
                )}
              </td>
              <td className="text-xs"><Promised job={job} /></td>
              <td className="tabular-nums text-steel">{ageLabel(job.createdAt)}</td>
              <td className="text-right font-bold tabular-nums">{money(job.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
