'use client';

import { Clock, FlaskConical, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { MAX_STEPS, type StepDraft } from './campaign-input';
import { MessageEditor } from './MessageEditor';

const UNITS = [{ value: 60, label: 'hours' }, { value: 1440, label: 'days' }] as const;

interface StepsComposerProps {
  channel: 'email' | 'sms';
  kind: 'broadcast' | 'drip' | 'lifecycle';
  steps: StepDraft[];
  onChange: (steps: StepDraft[]) => void;
}

function DelayInput({ minutes, onChange, first }: { minutes: number; onChange: (m: number) => void; first: boolean }) {
  const unit = minutes % 1440 === 0 ? 1440 : 60;
  const amount = minutes / unit;
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm text-chalk/75">
      <Clock className="size-4 text-steel" aria-hidden="true" />
      {first ? 'Send' : 'Wait'}
      <input type="number" min={0} max={365} inputMode="numeric" value={amount} aria-label="Delay amount"
        onChange={(e) => onChange(Math.max(0, Math.round((Number(e.target.value) || 0) * unit)))}
        className="h-9 w-16 rounded-sm border border-line bg-carbon px-2 text-center tabular-nums text-chalk focus:border-clover focus:outline-none" />
      <select aria-label="Delay unit" value={unit} onChange={(e) => onChange(amount * Number(e.target.value))}
        className="h-9 rounded-sm border border-line bg-carbon px-2 text-chalk focus:border-clover focus:outline-none">
        {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
      </select>
      {first ? 'after they enroll' : 'after the last step'}
    </label>
  );
}

/** One or more message steps. Step 1 can carry an A/B variant. Drips add timed steps. */
export function StepsComposer({ channel, kind, steps, onChange }: StepsComposerProps) {
  const [activeVariant, setActiveVariant] = useState<'A' | 'B'>('A');
  const orders = [...new Set(steps.map((s) => s.order))].sort((a, b) => a - b);
  const hasB = steps.some((s) => s.order === 1 && s.variant === 'B');

  const patch = (order: number, variant: 'A' | 'B', next: Partial<StepDraft>) =>
    onChange(steps.map((s) => (s.order === order && s.variant === variant ? { ...s, ...next } : s)));

  function toggleB() {
    if (hasB) {
      onChange(steps.filter((s) => !(s.order === 1 && s.variant === 'B')));
      setActiveVariant('A');
      return;
    }
    const a = steps.find((s) => s.order === 1 && s.variant === 'A');
    onChange([...steps, { order: 1, variant: 'B', delayMinutes: a?.delayMinutes ?? 0, subject: a?.subject ?? '', body: a?.body ?? '' }]);
    setActiveVariant('B');
  }

  function addStep() {
    const next = (orders.at(-1) ?? 0) + 1;
    onChange([...steps, { order: next, variant: 'A', delayMinutes: 3 * 1440, subject: '', body: '' }]);
  }

  function removeStep(order: number) {
    onChange(steps.filter((s) => s.order !== order).map((s) => (s.order > order ? { ...s, order: s.order - 1 } : s)));
  }

  return (
    <ol className="grid gap-4">
      {orders.map((order) => {
        const variant = order === 1 && hasB ? activeVariant : 'A';
        const step = steps.find((s) => s.order === order && s.variant === variant)!;
        return (
          <li key={order} className="rounded-md border border-line bg-carbon p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-bold">
                <span className="grid size-6 place-items-center rounded-full bg-clover text-xs text-carbon">{order}</span>
                {kind === 'broadcast' ? 'Message' : `Step ${order}`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {order === 1 && hasB && (
                  <span role="tablist" aria-label="Variant" className="inline-flex rounded-sm border border-violet/40 p-0.5">
                    {(['A', 'B'] as const).map((v) => (
                      <button key={v} type="button" role="tab" aria-selected={activeVariant === v} onClick={() => setActiveVariant(v)}
                        className={`h-7 w-9 rounded-sm text-xs font-bold ${activeVariant === v ? 'bg-violet text-chalk' : 'text-steel hover:text-chalk'}`}>{v}</button>
                    ))}
                  </span>
                )}
                {order === 1 && (
                  <button type="button" onClick={toggleB} className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-violet/40 px-2.5 text-xs font-semibold text-violet-300 hover:bg-violet/15">
                    <FlaskConical className="size-3.5" aria-hidden="true" /> {hasB ? 'Remove B test' : 'Add A/B test'}
                  </button>
                )}
                {order > 1 && (
                  <button type="button" onClick={() => removeStep(order)} aria-label={`Remove step ${order}`} className="grid size-8 place-items-center rounded-sm text-steel hover:bg-gunmetal hover:text-danger">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            {kind !== 'broadcast' && (
              <div className="mb-3"><DelayInput minutes={step.delayMinutes} first={order === 1} onChange={(m) => onChange(steps.map((s) => (s.order === order ? { ...s, delayMinutes: m } : s)))} /></div>
            )}
            <MessageEditor key={`${order}-${variant}`} id={`step-${order}-${variant}`} channel={channel} subject={step.subject} body={step.body}
              onChange={(next) => patch(order, variant, next)} />
          </li>
        );
      })}
      {kind !== 'broadcast' && orders.length < MAX_STEPS && (
        <li>
          <button type="button" onClick={addStep} className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-dashed border-clover/40 px-3 text-sm font-semibold text-clover hover:border-clover hover:bg-clover/[0.06]">
            <Plus className="size-4" aria-hidden="true" /> Add step
          </button>
        </li>
      )}
    </ol>
  );
}
