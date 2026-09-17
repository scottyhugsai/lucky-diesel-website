import { CalendarX2, Check, Circle, Trash2 } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import type { ActionState } from '@/components/admin/core/parse';
import { Badge, Card, EmptyState, fieldClass, labelClass } from '@/components/app/ui';
import { closureText } from '@/lib/marketing/content/seo-local';
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

const TASK_LABEL: Record<string, string> = { todo: 'To do', done: 'Done', skip: 'Skip' };

/** Brand disambiguation (quarterly) and local PR / backlink tasks. */
export function SeoTasksPanel({ tasks, action }: { tasks: LocalSeoStatus['tasks']; action: Action }) {
  const groups = [
    { key: 'brand', title: 'Brand check · quarterly' },
    { key: 'pr', title: 'Local PR + links' },
  ] as const;
  return (
    <Card title="Brand + PR tasks">
      {groups.map((group) => {
        const rows = tasks.filter((t) => t.category === group.key);
        const due = rows.filter((t) => t.due).length;
        return (
          <section key={group.key} className="mb-5 last:mb-0">
            <h3 className="kicker mb-2 flex items-center gap-2">{group.title}{due > 0 && <Badge tone="warn">{due} due</Badge>}</h3>
            <ul className="grid gap-2">
              {rows.map((t) => (
                <li key={t.id} className="rounded-sm border border-line bg-carbon p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{t.title}</p>
                    <Badge tone={t.due ? 'warn' : t.status === 'done' ? 'good' : 'neutral'}>{t.due && t.status === 'done' ? 'Due again' : TASK_LABEL[t.status] ?? t.status}</Badge>
                  </div>
                  {t.hint && <p className="mt-1 text-xs text-chalk/55">{t.hint}</p>}
                  {t.notes && <p className="mt-1 text-xs text-chalk/75">{t.notes}</p>}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-chalk/70 hover:text-chalk">Update</summary>
                    <ActionForm action={action} className="mt-2 grid gap-2">
                      <input type="hidden" name="id" value={t.id} />
                      <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                        <select name="status" defaultValue={t.status === 'done' && t.due ? 'todo' : t.status} aria-label={`${t.title} status`} className={`${fieldClass} h-9 text-sm`}>
                          {Object.entries(TASK_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        <input name="url" type="url" defaultValue={t.url ?? ''} placeholder="https:// (proof link)" aria-label={`${t.title} link`} className={`${fieldClass} h-9 text-sm`} />
                      </div>
                      <input name="notes" defaultValue={t.notes ?? ''} maxLength={500} placeholder="Notes" aria-label={`${t.title} notes`} className={`${fieldClass} h-9 text-sm`} />
                      <div><PendingButton size="sm" variant="secondary">Save</PendingButton></div>
                    </ActionForm>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Card>
  );
}

/** Holiday and special hours: drives the site banner. Google Business Profile hours are set by the owner. */
export function ClosuresPanel({ closures, addAction, deleteAction }: { closures: LocalSeoStatus['closures']; addAction: Action; deleteAction: Action }) {
  return (
    <Card title={<span className="inline-flex items-center gap-2"><CalendarX2 className="size-5 text-amber-300" aria-hidden="true" />Holiday hours</span>}>
      {closures.length ? (
        <ul className="mb-4 grid gap-2">
          {closures.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2 rounded-sm border border-line bg-carbon p-3 text-sm">
              <span className="min-w-0">{closureText(c)}</span>
              <ActionForm action={deleteAction} confirm="Remove this notice?">
                <input type="hidden" name="id" value={c.id} />
                <PendingButton size="sm" variant="ghost" aria-label={`Remove ${c.label}`}><Trash2 className="size-4" aria-hidden="true" /></PendingButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mb-4"><EmptyState title="No upcoming closures">Add one and the site shows a banner.</EmptyState></div>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-chalk/70 hover:text-chalk">Add closure</summary>
        <ActionForm action={addAction} className="mt-3 grid gap-3">
          <div>
            <label className={labelClass} htmlFor="cl-label">Name</label>
            <input id="cl-label" name="label" required maxLength={80} placeholder="Thanksgiving" className={fieldClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="cl-start">Start</label>
              <input id="cl-start" name="starts_on" type="date" required className={fieldClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="cl-end">End</label>
              <input id="cl-end" name="ends_on" type="date" className={fieldClass} />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="cl-mode">Hours</label>
            <select id="cl-mode" name="mode" defaultValue="closed" className={fieldClass}>
              <option value="closed">Closed</option>
              <option value="special">Special hours</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="cl-msg">Message</label>
            <input id="cl-msg" name="message" maxLength={200} placeholder="Back Monday 8am." className={fieldClass} />
          </div>
          <div><PendingButton size="sm">Add closure</PendingButton></div>
          <p className="text-xs text-chalk/55">Update Google hours yourself until Google is connected.</p>
        </ActionForm>
      </details>
    </Card>
  );
}
