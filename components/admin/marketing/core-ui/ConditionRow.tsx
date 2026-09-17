'use client';

import { X } from 'lucide-react';
import { FIELDS, fieldMeta, newRow, toCondition, type RowState } from './segment-fields';

const control = 'h-10 rounded-sm border border-line bg-carbon px-2.5 text-sm text-chalk focus:border-clover focus:outline-none focus:ring-2 focus:ring-clover/30';
const GROUPS = [...new Set(FIELDS.map((f) => f.group))];

interface ConditionRowProps {
  row: RowState;
  index: number;
  onChange: (row: RowState) => void;
  onRemove: () => void;
}

export function ConditionRow({ row, index, onChange, onRemove }: ConditionRowProps) {
  const meta = fieldMeta(row.field);
  const set = (patch: Partial<RowState>) => onChange({ ...row, ...patch });
  const complete = toCondition(row) !== null;
  const numeric = meta.kind === 'number' || meta.kind === 'money';

  function toggleValue(value: string) {
    set({ values: row.values.includes(value) ? row.values.filter((v) => v !== value) : [...row.values, value] });
  }

  return (
    <li className={`relative rounded-md border bg-carbon p-3 transition-colors ${complete ? 'border-line' : 'border-amber-400/40'}`}>
      <div className="flex flex-wrap items-center gap-2 pr-9">
        <span className="grid size-6 place-items-center rounded-full bg-gunmetal text-xs font-bold text-steel" aria-hidden="true">{index + 1}</span>
        <label className="sr-only" htmlFor={`${row.key}-field`}>Rule {index + 1} field</label>
        <select id={`${row.key}-field`} value={row.field} onChange={(e) => onChange({ ...newRow(e.target.value as RowState['field']), key: row.key })} className={`${control} font-semibold`}>
          {GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {FIELDS.filter((f) => f.group === group).map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
            </optgroup>
          ))}
        </select>
        {meta.ops.length > 1 && (
          <select aria-label="Operator" value={row.op} onChange={(e) => set({ op: e.target.value })} className={control}>
            {meta.ops.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
          </select>
        )}
        {meta.ops.length === 1 && <span className="text-sm text-steel">{meta.ops[0]!.label}</span>}
      </div>
      <button type="button" onClick={onRemove} aria-label={`Remove rule ${index + 1}`} className="absolute right-2 top-2 grid size-8 place-items-center rounded-sm text-steel hover:bg-gunmetal hover:text-danger">
        <X className="size-4" aria-hidden="true" />
      </button>

      <div className="mt-2.5">
        {(meta.kind === 'choice' || meta.kind === 'consent') && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${meta.label} values`}>
            {meta.options!.map((option) => {
              const on = row.values.includes(option.value);
              return (
                <button key={option.value} type="button" aria-pressed={on}
                  onClick={() => (meta.kind === 'consent' ? set({ values: [option.value] }) : toggleValue(option.value))}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors active:translate-y-px ${on ? 'border-clover bg-clover text-carbon' : 'border-line text-chalk/75 hover:border-chalk/40'}`}>
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
        {meta.kind === 'text' && (
          <input aria-label={`${meta.label} values, comma separated`} value={row.text} onChange={(e) => set({ text: e.target.value })} placeholder={meta.placeholder} className={`${control} w-full`} />
        )}
        {meta.kind === 'bool' && (
          <div className="flex gap-1.5" role="group" aria-label={meta.label}>
            {[true, false].map((b) => (
              <button key={String(b)} type="button" aria-pressed={row.bool === b} onClick={() => set({ bool: b })}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${row.bool === b ? 'border-clover bg-clover text-carbon' : 'border-line text-chalk/75'}`}>
                {b ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        )}
        {numeric && (
          <div className="flex flex-wrap items-center gap-2">
            {row.op === 'between' ? (
              <>
                <input aria-label="Minimum" inputMode="numeric" value={row.min} onChange={(e) => set({ min: e.target.value })} placeholder="From" className={`${control} w-28`} />
                <span className="text-sm text-steel">to</span>
                <input aria-label="Maximum" inputMode="numeric" value={row.max} onChange={(e) => set({ max: e.target.value })} placeholder="To" className={`${control} w-28`} />
              </>
            ) : (
              <input aria-label="Value" inputMode="numeric" value={row.value} onChange={(e) => set({ value: e.target.value })} placeholder="Amount" className={`${control} w-32`} />
            )}
            <span className="text-sm text-steel">{meta.unit}</span>
            {meta.presets?.map((p) => (
              <button key={p.label} type="button" onClick={() => set({ op: p.op, min: String(p.min ?? ''), max: String(p.max ?? ''), value: String(p.value ?? '') })}
                className="rounded-sm border border-dashed border-line px-2 py-1 text-xs font-semibold text-steel hover:border-clover hover:text-clover">
                {p.label}
              </button>
            ))}
          </div>
        )}
        {row.field === 'service_history' && (
          <label className="mt-2 flex items-center gap-2 text-sm text-steel">
            within last
            <input inputMode="numeric" value={row.withinDays} onChange={(e) => set({ withinDays: e.target.value })} placeholder="any" className={`${control} w-20`} />
            days
          </label>
        )}
      </div>
    </li>
  );
}
