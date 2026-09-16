import { Eye, Lock, Mail, MessageSquare } from 'lucide-react';
import { Avatar, Badge } from '@/components/app/ui';
import { WORK_ORDER_STATUS, dateTime, relativeTime } from '@/lib/format';
import type { JobDetail } from './job-detail-data';
import { NoteForm, PartStatusForm } from './JobSideForms';

export function NotesView({ workOrderId, notes }: { workOrderId: string; notes: JobDetail['notes'] }) {
  return (
    <div className="grid gap-4">
      <NoteForm workOrderId={workOrderId} />
      {notes.length > 0 && (
        <ul className="grid gap-3">
          {notes.map((note) => (
            <li key={note.id} className={`rounded-sm border p-3 text-sm ${note.internal ? 'border-line bg-carbon' : 'border-sky-400/25 bg-sky-400/5'}`}>
              <p className="whitespace-pre-line text-chalk/85">{note.body}</p>
              <p className="mt-2 flex items-center gap-2 text-xs text-steel">
                <Avatar name={note.profiles?.full_name ?? 'Shop'} color={note.profiles?.avatar_color} size={18} />
                {note.profiles?.full_name ?? 'Shop'} · {relativeTime(note.created_at)}
                <span className="ml-auto inline-flex items-center gap-1 font-semibold">
                  {note.internal ? <><Lock className="size-3" aria-hidden="true" /> Internal</> : <><Eye className="size-3 text-sky-300" aria-hidden="true" /> <span className="text-sky-300">Customer sees</span></>}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const PART_TONE = { requested: 'warn', ordered: 'info', received: 'good' } as const;

export function PartsView({ workOrderId, parts }: { workOrderId: string; parts: JobDetail['parts'] }) {
  if (!parts.length) return <p className="text-sm text-steel">No parts requested by the tech.</p>;
  return (
    <ul className="divide-y divide-line">
      {parts.map((part) => (
        <li key={part.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
          <div className="min-w-0 flex-1 basis-48">
            <p className="font-semibold">{part.description}</p>
            <p className="text-xs text-steel">{part.profiles?.full_name ?? 'Shop'} · {relativeTime(part.created_at)}</p>
          </div>
          <Badge tone={PART_TONE[part.status]}>{part.status}</Badge>
          <PartStatusForm workOrderId={workOrderId} partId={part.id} status={part.status} />
        </li>
      ))}
    </ul>
  );
}

export function HistoryView({ events }: { events: JobDetail['events'] }) {
  return (
    <ol className="relative grid gap-4 border-l border-line pl-5">
      {events.map((event, index) => (
        <li key={event.id} className="relative text-sm">
          <span className={`absolute -left-[1.6rem] top-1 size-2.5 rounded-full ring-4 ring-carbon-2 ${index === 0 ? 'bg-clover' : 'bg-steel'}`} aria-hidden="true" />
          <p>
            <span className="font-semibold">{WORK_ORDER_STATUS[event.to_status].label}</span>
            {event.from_status && <span className="text-steel"> from {WORK_ORDER_STATUS[event.from_status].label}</span>}
          </p>
          <p className="text-xs text-steel">{event.profiles?.full_name ?? 'System'} · {dateTime(event.created_at)}</p>
          {event.note && <p className="mt-0.5 text-xs text-chalk/65">{event.note}</p>}
        </li>
      ))}
    </ol>
  );
}

const MESSAGE_TONE = { sent: 'good', simulated: 'violet', queued: 'neutral', failed: 'bad', skipped: 'warn' } as const;

export function MessagesView({ messages }: { messages: JobDetail['messages'] }) {
  if (!messages.length) return <p className="text-sm text-steel">No texts or emails about this job yet.</p>;
  return (
    <ul className="grid gap-3">
      {messages.map((m) => {
        const Icon = m.channel === 'sms' ? MessageSquare : Mail;
        return (
          <li key={m.id} className="rounded-sm border border-line bg-carbon p-3 text-sm">
            <p className="flex flex-wrap items-center gap-2 text-xs text-steel">
              <Icon className="size-3.5" aria-hidden="true" />
              <span className="font-semibold uppercase tracking-wider">{m.channel}</span>
              <span className="truncate">{m.direction === 'inbound' ? 'from' : 'to'} {m.to_address}</span>
              <Badge tone={MESSAGE_TONE[m.status]} className="ml-auto">{m.status}</Badge>
            </p>
            {m.subject && <p className="mt-1.5 font-semibold">{m.subject}</p>}
            <p className="mt-1 line-clamp-4 whitespace-pre-line text-chalk/75">{m.body}</p>
            <p className="mt-1.5 text-xs text-steel">
              {dateTime(m.created_at)}
              {m.automation_key && ` · automation: ${m.automation_key}`}
              {m.error && <span className="text-danger"> · {m.error}</span>}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
