import Link from 'next/link';
import { Phone } from 'lucide-react';
import { assignLeadAction, markContactedAction, snoozeLeadAction } from './actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, EmptyState, PageHeader, fieldClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { teamMembers } from '@/lib/marketing/core/crm-data';
import { loadTaskQueue } from '@/lib/marketing/core/task-queue';
import { TASK_LABELS, type Task, type TaskKind } from '@/lib/marketing/core/tasks';
import { sweepSoon } from '@/lib/marketing/core/crm-sweep';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Today | Marketing' };

const TONE: Record<TaskKind, 'info' | 'warn' | 'bad' | 'good' | 'neutral'> = {
  new_lead: 'bad',
  unanswered: 'warn',
  hot: 'info',
  follow_up: 'good',
  quote_expiring: 'warn',
  stale: 'neutral',
};

const SNOOZE_OPTIONS = [
  { hours: 24, label: 'Tomorrow' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: 'Next week' },
];

function TaskCard({ task, team }: { task: Task; team: { id: string; name: string }[] }) {
  return (
    <li className="grid gap-3 rounded-md border border-line bg-carbon-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone={TONE[task.kind]}>{TASK_LABELS[task.kind]}</Badge>
            <span className="display truncate text-2xl not-italic">{task.title}</span>
          </p>
          <p className="mt-1 text-sm text-chalk/65">{task.detail}</p>
        </div>
        {task.phone && (
          <a href={`tel:${task.phone.replace(/[^\d+]/g, '')}`} className="inline-flex h-10 items-center gap-2 rounded-sm border border-clover/60 px-3 text-sm font-semibold text-clover hover:bg-clover hover:text-carbon">
            <Phone className="size-4" aria-hidden="true" /> Call
          </a>
        )}
      </div>

      <details className="rounded-sm border border-line bg-carbon">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-chalk/80 hover:text-clover">Call script</summary>
        <p className="whitespace-pre-line border-t border-line px-3 py-2 text-sm text-chalk/80">{task.script}</p>
      </details>

      <div className="flex flex-wrap items-end gap-2">
        {task.threadKey && (
          <Link href={`/admin/marketing/contacts/inbox?t=${encodeURIComponent(task.threadKey)}`} className="inline-flex h-9 items-center rounded-sm border border-line px-3 text-sm font-semibold hover:border-clover hover:text-clover">
            Open thread
          </Link>
        )}
        {task.workOrderId && (
          <Link href={`/admin/jobs/${task.workOrderId}`} className="inline-flex h-9 items-center rounded-sm border border-line px-3 text-sm font-semibold hover:border-clover hover:text-clover">
            Open estimate
          </Link>
        )}
        {task.leadId && (
          <>
            <ActionForm action={markContactedAction} feedback="none" aria-label="Mark reached">
              <input type="hidden" name="lead_id" value={task.leadId} />
              <PendingButton variant="secondary" size="sm">Reached them</PendingButton>
            </ActionForm>
            <ActionForm action={snoozeLeadAction} feedback="none" className="flex items-end gap-1" aria-label="Snooze lead">
              <input type="hidden" name="lead_id" value={task.leadId} />
              <label className="sr-only" htmlFor={`snooze-${task.id}`}>Snooze</label>
              <select id={`snooze-${task.id}`} name="hours" className={`${fieldClass} h-9 w-auto`} defaultValue="24">
                {SNOOZE_OPTIONS.map((o) => <option key={o.hours} value={o.hours}>{o.label}</option>)}
              </select>
              <PendingButton variant="ghost" size="sm">Snooze</PendingButton>
            </ActionForm>
            <ActionForm action={assignLeadAction} feedback="none" className="flex items-end gap-1" aria-label="Assign lead">
              <input type="hidden" name="lead_id" value={task.leadId} />
              <label className="sr-only" htmlFor={`assign-${task.id}`}>Owner</label>
              <select id={`assign-${task.id}`} name="assigned_to" className={`${fieldClass} h-9 w-auto`} defaultValue="">
                <option value="">Unassigned</option>
                {team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
              <PendingButton variant="ghost" size="sm">Assign</PendingButton>
            </ActionForm>
          </>
        )}
      </div>
    </li>
  );
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ who?: string | string[] }> }) {
  const viewer = await requireRole('admin');
  const rawWho = (await searchParams).who;
  const who = (Array.isArray(rawWho) ? rawWho[0] : rawWho) === 'mine' ? 'mine' : 'all';
  const db = createAdminClient();
  await sweepSoon();
  const [{ tasks, mine }, team] = await Promise.all([loadTaskQueue(viewer.userId, db), teamMembers(db)]);
  const shown = who === 'mine' ? mine : tasks;

  return (
    <>
      <PageHeader
        kicker="Contacts"
        title="Today"
        description="Who to call or text next, most urgent first."
        actions={
          <div role="group" aria-label="Whose list" className="inline-flex rounded-sm border border-line bg-carbon p-0.5">
            {(['all', 'mine'] as const).map((option) => (
              <Link
                key={option}
                href={option === 'all' ? '/admin/marketing/contacts/tasks' : '/admin/marketing/contacts/tasks?who=mine'}
                aria-current={who === option ? 'true' : undefined}
                className={`inline-flex h-8 items-center rounded-sm px-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                  who === option ? 'bg-clover text-carbon' : 'text-steel hover:text-chalk'
                }`}
              >
                {option === 'all' ? `Everyone ${tasks.length}` : `Mine ${mine.length}`}
              </Link>
            ))}
          </div>
        }
      />

      {shown.length === 0 ? (
        <EmptyState title="Nothing waiting">New leads, unanswered texts and expiring estimates land here.</EmptyState>
      ) : (
        <Card title={`${shown.length} to work`} padded={false}>
          <ul className="grid gap-3 p-4">
            {shown.map((task) => <TaskCard key={task.id} task={task} team={team} />)}
          </ul>
        </Card>
      )}
    </>
  );
}
