import { Clock3, Mail, MessageSquare, SkipForward } from 'lucide-react';
import type { AutomationStats } from './automation-data';
import { MINUTES_PER_MESSAGE } from './automation-meta';

function Tile({ label, icon, children, hint }: { label: string; icon: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-carbon-2 p-4 sm:p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-steel">{icon}{label}</p>
      <div className="mt-2">{children}</div>
      {hint && <div className="mt-1.5 text-xs text-chalk/55">{hint}</div>}
    </div>
  );
}

export function AutomationStatsRow({ stats }: { stats: AutomationStats }) {
  const hours = (stats.automatedMessages * MINUTES_PER_MESSAGE) / 60;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Sent · 7 days" icon={<MessageSquare className="size-3.5" aria-hidden="true" />} hint="Automated messages delivered">
        <p className="display text-4xl not-italic tabular-nums text-clover">{stats.textsSent + stats.emailsSent}</p>
        <p className="mt-1 flex gap-3 text-sm tabular-nums text-chalk/70">
          <span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5" aria-hidden="true" />{stats.textsSent} texts</span>
          <span className="inline-flex items-center gap-1"><Mail className="size-3.5" aria-hidden="true" />{stats.emailsSent} emails</span>
        </p>
      </Tile>
      <Tile label="Scheduled" icon={<Clock3 className="size-3.5" aria-hidden="true" />} hint="Queued follow-ups and reminders">
        <p className="display text-4xl not-italic tabular-nums text-sky-300">{stats.scheduled}</p>
      </Tile>
      <Tile
        label="Skipped · 7 days"
        icon={<SkipForward className="size-3.5" aria-hidden="true" />}
        hint={stats.topSkipReasons.length ? (
          <ul className="space-y-0.5">
            {stats.topSkipReasons.map((r) => <li key={r.reason} className="truncate"><b className="tabular-nums text-amber-300">{r.count}×</b> {r.reason}</li>)}
          </ul>
        ) : 'Nothing skipped'}
      >
        <p className="display text-4xl not-italic tabular-nums text-amber-300">{stats.skipped}</p>
      </Tile>
      <Tile label="Time saved · 7 days" icon={<Clock3 className="size-3.5" aria-hidden="true" />} hint={`Estimate: ${MINUTES_PER_MESSAGE} min per message you didn’t type`}>
        <p className="display text-4xl not-italic tabular-nums">{hours < 10 ? hours.toFixed(1) : Math.round(hours)}<span className="ml-1 text-xl text-chalk/60">hrs</span></p>
      </Tile>
    </div>
  );
}
