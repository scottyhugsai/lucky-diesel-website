import Link from 'next/link';
import { Badge, EmptyState, TableWrap, tableClass } from '@/components/app/ui';
import type { Tables } from '@/lib/db/database.types';
import { dateTime } from '@/lib/format';
import { RUN_STATUS_TONE, subjectHref } from './automation-meta';

export type RunRow = Pick<Tables<'automation_runs'>, 'id' | 'automation_key' | 'subject_type' | 'subject_id' | 'status' | 'scheduled_for' | 'executed_at' | 'detail'>;

const SUBJECT_LABEL: Record<string, string> = {
  lead: 'Lead', work_order: 'Job', invoice: 'Invoice', appointment: 'Appointment', customer: 'Customer', shop: 'Shop',
};

export function RunsTable({ runs, names, showAutomation = true }: { runs: RunRow[]; names: Map<string, string>; showAutomation?: boolean }) {
  if (!runs.length) return <EmptyState title="No runs yet">Runs appear here the moment an automation is triggered.</EmptyState>;
  return (
    <TableWrap>
      <table className={tableClass}>
        <thead>
          <tr>
            <th scope="col">Status</th>
            {showAutomation && <th scope="col">Automation</th>}
            <th scope="col">Subject</th>
            <th scope="col">Scheduled for</th>
            <th scope="col">Executed</th>
            <th scope="col">Detail</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const href = subjectHref(run.subject_type, run.subject_id);
            const label = SUBJECT_LABEL[run.subject_type] ?? run.subject_type;
            return (
              <tr key={run.id} className="align-top">
                <td><Badge tone={RUN_STATUS_TONE[run.status]}>{run.status}</Badge></td>
                {showAutomation && (
                  <td className="font-semibold">
                    <Link href={`/admin/automations/${run.automation_key}`} className="hover:text-clover">{names.get(run.automation_key) ?? run.automation_key}</Link>
                  </td>
                )}
                <td>{href ? <Link href={href} className="text-clover hover:underline">{label}</Link> : <span className="text-chalk/70">{label}</span>}</td>
                <td className="whitespace-nowrap tabular-nums text-chalk/80">{dateTime(run.scheduled_for)}</td>
                <td className="whitespace-nowrap tabular-nums text-chalk/60">{run.executed_at ? dateTime(run.executed_at) : '—'}</td>
                <td className="max-w-[22rem] break-words text-xs text-chalk/65">{run.detail ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableWrap>
  );
}
