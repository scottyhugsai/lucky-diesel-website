import Link from 'next/link';
import { CircleCheck, CircleDashed, CircleSlash, CircleX, Clock } from 'lucide-react';
import { dateTime } from '@/lib/format';
import type { RunRow } from './RunsTable';

const ICON = {
  sent: <CircleCheck className="size-4 text-clover" aria-hidden="true" />,
  scheduled: <Clock className="size-4 text-sky-300" aria-hidden="true" />,
  skipped: <CircleSlash className="size-4 text-amber-300" aria-hidden="true" />,
  failed: <CircleX className="size-4 text-danger" aria-hidden="true" />,
  cancelled: <CircleDashed className="size-4 text-steel" aria-hidden="true" />,
} as const;

const VERB = { sent: 'Sent', scheduled: 'Scheduled for', skipped: 'Skipped', failed: 'Failed', cancelled: 'Cancelled' } as const;

/** Vertical timeline of automation runs for one lead / customer. */
export function AutomationTimeline({ runs, names, empty = 'No automations have run for this lead yet.' }: { runs: RunRow[]; names: Map<string, string>; empty?: string }) {
  if (!runs.length) return <p className="text-sm text-steel">{empty}</p>;
  return (
    <ol className="relative grid gap-4 border-l border-line pl-5">
      {runs.map((run) => (
        <li key={run.id} className="relative">
          <span className="absolute -left-[1.72rem] top-0.5 grid size-5 place-items-center rounded-full bg-carbon-2">{ICON[run.status]}</span>
          <p className="text-sm font-semibold">
            <Link href={`/admin/automations/${run.automation_key}`} className="hover:text-clover">{names.get(run.automation_key) ?? run.automation_key}</Link>
          </p>
          <p className="text-xs tabular-nums text-chalk/60">
            {VERB[run.status]} {run.status === 'scheduled' ? dateTime(run.scheduled_for) : dateTime(run.executed_at ?? run.scheduled_for)}
          </p>
          {run.detail && <p className={`mt-0.5 break-words text-xs ${run.status === 'skipped' ? 'text-amber-200/80' : 'text-steel'}`}>{run.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
