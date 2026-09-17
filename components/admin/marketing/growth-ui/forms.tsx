import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import type { ActionState } from '@/components/admin/core/parse';
import { fieldClass } from '@/components/app/ui';
import type { CustomerOption } from './growth-data';

type ServerAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** One-button form that flips a boolean. `next` is the value it will set. */
export function ToggleButton({ action, hidden, next, onLabel, offLabel, name = 'active' }: {
  action: ServerAction; hidden: Record<string, string>; next: boolean; onLabel: string; offLabel: string; name?: string;
}) {
  return (
    <ActionForm action={action} className="inline-flex flex-col">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {next && <input type="hidden" name={name} value="on" />}
      <PendingButton size="sm" variant={next ? 'secondary' : 'ghost'}>{next ? onLabel : offLabel}</PendingButton>
    </ActionForm>
  );
}

export function CustomerSelect({ customers, id, name = 'customer_id' }: { customers: CustomerOption[]; id: string; name?: string }) {
  return (
    <select id={id} name={name} required defaultValue="" className={fieldClass}>
      <option value="" disabled>Pick a customer</option>
      {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

export function SegmentSelect({ segments, id, name = 'segment_id', required = false, emptyLabel = 'Everyone' }: {
  segments: { id: string; name: string; count: number }[]; id: string; name?: string; required?: boolean; emptyLabel?: string;
}) {
  return (
    <select id={id} name={name} required={required} defaultValue="" className={fieldClass}>
      <option value="" disabled={required}>{emptyLabel}</option>
      {segments.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.count})</option>)}
    </select>
  );
}
