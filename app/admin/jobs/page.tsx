import Link from 'next/link';
import { KanbanSquare, List, Plus, Search } from 'lucide-react';
import { JobBoard, JobTable } from '@/components/admin/core/JobViews';
import { filterJobs, loadJobs } from '@/components/admin/core/jobs-data';
import { ButtonLink, PageHeader, buttonClass, fieldClass } from '@/components/app/ui';
import type { Enums } from '@/lib/db/database.types';
import { WORK_ORDER_STATUS, money } from '@/lib/format';
import { requireRole } from '@/lib/auth';

export const metadata = { title: 'Jobs | Lucky Diesel Admin' };

type Status = Enums<'work_order_status'>;
const STATUSES = Object.keys(WORK_ORDER_STATUS) as Status[];

function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.slice(0, 80) ?? '';
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole('admin');
  const params = await searchParams;
  const view = param(params.view) === 'list' ? 'list' : 'board';
  const q = param(params.q);
  const statusParam = param(params.status);
  const status = (STATUSES as string[]).includes(statusParam) ? (statusParam as Status) : null;

  const jobs = await loadJobs({ boardOnly: view === 'board' });
  const shown = view === 'list' ? filterJobs(jobs, q, status) : jobs;
  const overdue = jobs.filter((j) => j.isOverdue).length;
  const openValue = jobs.filter((j) => !['paid', 'cancelled'].includes(j.status)).reduce((sum, j) => sum + j.totalCents, 0);

  const toggle = (target: 'board' | 'list') =>
    `inline-flex h-9 items-center gap-2 rounded-sm px-3 text-sm font-semibold transition-colors ${view === target ? 'bg-gunmetal text-chalk' : 'text-steel hover:text-chalk'}`;

  return (
    <div>
      <PageHeader
        kicker="Work orders"
        title="Jobs"
        description={
          <>
            {money(openValue, { whole: true })} of open work on the floor
            {overdue > 0 && <span className="font-semibold text-danger"> · {overdue} past promised time</span>}
          </>
        }
        actions={
          <ButtonLink href="/admin/jobs/new">
            <Plus className="size-4" aria-hidden="true" />
            New job
          </ButtonLink>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Job view" className="flex gap-1 rounded-sm border border-line bg-carbon-2 p-1">
          <Link href="/admin/jobs" className={toggle('board')} aria-current={view === 'board' ? 'page' : undefined}>
            <KanbanSquare className="size-4" aria-hidden="true" /> Board
          </Link>
          <Link href="/admin/jobs?view=list" className={toggle('list')} aria-current={view === 'list' ? 'page' : undefined}>
            <List className="size-4" aria-hidden="true" /> List
          </Link>
        </nav>

        {view === 'list' && (
          <form role="search" className="flex w-full flex-wrap gap-2 sm:w-auto" action="/admin/jobs">
            <input type="hidden" name="view" value="list" />
            <label className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
              <span className="sr-only">Search jobs</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-steel" aria-hidden="true" />
              <input name="q" defaultValue={q} placeholder="Customer, truck, VIN or WO #" className={`${fieldClass} h-10 pl-9`} />
            </label>
            <label className="min-w-0">
              <span className="sr-only">Status</span>
              <select name="status" defaultValue={status ?? ''} className={`${fieldClass} h-10 w-auto pr-8`}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{WORK_ORDER_STATUS[s].label}</option>
                ))}
              </select>
            </label>
            <button type="submit" className={buttonClass('secondary', 'sm')} style={{ height: '2.5rem' }}>Filter</button>
          </form>
        )}
      </div>

      {view === 'board' ? (
        <JobBoard jobs={shown} />
      ) : (
        <>
          <p className="mb-3 text-sm text-steel" aria-live="polite">
            {shown.length} job{shown.length === 1 ? '' : 's'}
            {q || status ? ' matching your filters' : ''}
            {(q || status) && (
              <>
                {' · '}
                <Link href="/admin/jobs?view=list" className="text-clover hover:underline">Clear</Link>
              </>
            )}
          </p>
          <JobTable jobs={shown} />
        </>
      )}
    </div>
  );
}
