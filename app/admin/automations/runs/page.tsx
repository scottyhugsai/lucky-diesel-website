import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { RunsTable } from '@/components/admin/ops/RunsTable';
import { PageHeader, fieldClass, labelClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import type { Enums } from '@/lib/db/database.types';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Automation run log | Lucky Diesel admin' };

const STATUSES: Enums<'automation_run_status'>[] = ['scheduled', 'sent', 'skipped', 'failed', 'cancelled'];
const SUBJECTS = ['lead', 'appointment', 'work_order', 'invoice', 'customer', 'shop'] as const;
const PAGE_SIZE = 200;

type Search = Promise<{ status?: string; automation?: string; subject?: string }>;

export default async function RunLogPage({ searchParams }: { searchParams: Search }) {
  await requireRole('admin');
  const params = await searchParams;
  const status = STATUSES.find((s) => s === params.status);
  const subject = SUBJECTS.find((s) => s === params.subject);
  const supabase = await createClient();
  const { data: automations } = await supabase.from('automations').select('key, name').order('sort');
  const automationKey = automations?.find((a) => a.key === params.automation)?.key;

  let query = supabase
    .from('automation_runs')
    .select('id, automation_key, subject_type, subject_id, status, scheduled_for, executed_at, detail')
    .order('scheduled_for', { ascending: false })
    .limit(PAGE_SIZE);
  if (status) query = query.eq('status', status);
  if (automationKey) query = query.eq('automation_key', automationKey);
  if (subject) query = query.eq('subject_type', subject);
  const { data: runs, error } = await query;

  const names = new Map((automations ?? []).map((a) => [a.key, a.name]));

  return (
    <>
      <Link href="/admin/automations" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-clover">
        <ArrowLeft className="size-4" aria-hidden="true" /> Automations
      </Link>
      <PageHeader kicker="Automations" title="Run log" description="Every automated message: what fired, when, and why anything was skipped." />

      <form className="mb-5 grid gap-3 rounded-md border border-line bg-carbon-2 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="status" className={labelClass}>Status</label>
          <select id="status" name="status" defaultValue={status ?? ''} className={fieldClass}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="automation" className={labelClass}>Automation</label>
          <select id="automation" name="automation" defaultValue={automationKey ?? ''} className={fieldClass}>
            <option value="">All automations</option>
            {(automations ?? []).map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="subject" className={labelClass}>Subject</label>
          <select id="subject" name="subject" defaultValue={subject ?? ''} className={fieldClass}>
            <option value="">Anything</option>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-go h-11 rounded-sm px-4 font-bold">Filter</button>
          {(status || automationKey || subject) && <Link href="/admin/automations/runs" className="inline-flex h-11 items-center px-3 text-sm font-semibold text-steel hover:text-chalk">Clear</Link>}
        </div>
      </form>

      {error && <p role="alert" className="mb-4 text-sm text-danger">Couldn’t load runs: {error.message}</p>}
      <p className="mb-2 text-xs text-steel">{runs?.length ?? 0} run{runs?.length === 1 ? '' : 's'}{runs?.length === PAGE_SIZE ? ` (latest ${PAGE_SIZE})` : ''}</p>
      <div className="rounded-md border border-line bg-carbon-2 sm:p-1">
        <RunsTable runs={runs ?? []} names={names} />
      </div>
    </>
  );
}
