import { Eye } from 'lucide-react';
import type { JobData } from '@/app/shop/jobs/[id]/_data';
import { Badge } from '@/components/app/ui';
import { firstName, relativeTime } from '@/lib/format';
import { NoteForm, PartRequestForm } from './NoteAndPartForms';

const PART_TONE = { requested: 'warn', ordered: 'info', received: 'good' } as const;

export function NotesPanel({ data, now }: { data: JobData; now: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <NoteForm workOrderId={data.job.id} />
      {data.notes.length > 0 && (
        <ol className="grid grid-cols-[minmax(0,1fr)] gap-2" aria-label="Notes, newest first">
          {data.notes.map((note) => (
            <li key={note.id} className={`rounded-md border p-3 ${note.internal ? 'border-line bg-carbon' : 'border-amber-400/30 bg-amber-400/5'}`}>
              <p className="whitespace-pre-line text-chalk/90">{note.body}</p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-steel">
                <span>{firstName(note.author?.full_name) || 'Shop'} · {relativeTime(note.created_at, new Date(now))}</span>
                {!note.internal && <Badge tone="warn"><Eye className="size-3" aria-hidden="true" />Customer can see</Badge>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function PartsPanel({ data, now }: { data: JobData; now: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <PartRequestForm workOrderId={data.job.id} />
      {data.parts.length > 0 ? (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2" aria-label="Part requests">
          {data.parts.map((part) => (
            <li key={part.id} className="flex items-center justify-between gap-3 rounded-md border border-line bg-carbon p-3">
              <div className="min-w-0">
                <p className="font-semibold text-chalk">{part.description}</p>
                <p className="text-xs text-steel">{relativeTime(part.created_at, new Date(now))}</p>
              </div>
              <Badge tone={PART_TONE[part.status]} className="shrink-0 capitalize">{part.status}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-chalk/55">No parts requested on this job.</p>
      )}
    </div>
  );
}
