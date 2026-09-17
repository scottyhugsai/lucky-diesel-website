import { Check, Circle } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import type { ActionState } from '@/components/admin/core/parse';
import { Badge, Card, fieldClass } from '@/components/app/ui';
import type { LocalSeoStatus } from '@/lib/marketing/content/seo-service';

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

const LISTING_LABEL: Record<string, string> = { not_started: 'Not started', claimed: 'Claimed', verified: 'Verified', needs_update: 'Needs update', not_applicable: 'Skip' };

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="display text-3xl not-italic tabular-nums">{pct}%</p>
        <p className="text-sm text-chalk/60">{done} of {total} done</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gunmetal" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Local SEO progress">
        <div className="h-full rounded-full bg-clover" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Local SEO checklist plus every directory listing with NAP consistency. */
export function LocalSeoPanel({ status, action }: { status: LocalSeoStatus; action: Action }) {
  const listingsDone = status.listings.filter((l) => ['verified', 'not_applicable'].includes(l.status) && l.napConsistent !== false).length;
  const done = status.checklist.filter((c) => c.done).length + listingsDone;
  const total = status.checklist.length + status.listings.length;

  return (
    <Card title="Local SEO">
      <Progress done={done} total={total} />
      <ul className="mt-4 grid gap-1.5">
        {status.checklist.map((item) => (
          <li key={item.key} className="flex items-start gap-2 text-sm">
            {item.done ? <Check className="mt-0.5 size-4 shrink-0 text-clover" aria-hidden="true" /> : <Circle className="mt-0.5 size-4 shrink-0 text-steel" aria-hidden="true" />}
            <span className={item.done ? 'text-chalk/60 line-through' : ''}>{item.label}</span>
            <span className="sr-only">{item.done ? 'done' : 'to do'}</span>
          </li>
        ))}
      </ul>

      <h3 className="kicker mb-2 mt-6">Listings · name, address, phone match</h3>
      <ul className="grid gap-2">
        {status.listings.map((l) => (
          <li key={l.id} className="rounded-sm border border-line bg-carbon p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{l.directory}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={l.status === 'verified' ? 'good' : l.status === 'needs_update' ? 'warn' : 'neutral'}>{LISTING_LABEL[l.status] ?? l.status}</Badge>
                {l.napConsistent === true && <Badge tone="good">NAP match</Badge>}
                {l.napConsistent === false && <Badge tone="bad">Mismatch: {l.mismatches.join(', ') || 'details'}</Badge>}
              </div>
            </div>
            {l.notes && <p className="mt-1 text-xs text-chalk/55">{l.notes}</p>}
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-semibold text-chalk/70 hover:text-chalk">Update</summary>
              <ActionForm action={action} className="mt-2 grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
                <input type="hidden" name="id" value={l.id} />
                <select name="status" defaultValue={l.status} aria-label={`${l.directory} status`} className={`${fieldClass} h-9 text-sm`}>
                  {Object.entries(LISTING_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input name="url" type="url" defaultValue={l.url ?? ''} placeholder="https://" aria-label={`${l.directory} link`} className={`${fieldClass} h-9 text-sm`} />
                <PendingButton size="sm" variant="secondary">Save</PendingButton>
              </ActionForm>
            </details>
          </li>
        ))}
      </ul>
    </Card>
  );
}
