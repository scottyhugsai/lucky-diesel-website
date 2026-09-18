'use client';

import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { buttonClass } from '@/components/app/ui';

interface Option {
  value: string;
  label: string;
}

/**
 * Ordered pick-list for `list` fields. Arrows rather than drag-and-drop: this is
 * used one-handed on a phone in a shop, and arrows work with a keyboard too.
 * The value reaches the server as a comma-separated hidden input.
 */
export function OrderList({ name, options, initial, max }: { name: string; options: readonly Option[]; initial: readonly string[]; max?: number }) {
  const [chosen, setChosen] = useState<string[]>(() => initial.filter((value) => options.some((option) => option.value === value)));
  const labelOf = (value: string) => options.find((option) => option.value === value)?.label ?? value;
  const available = options.filter((option) => !chosen.includes(option.value));
  const full = max !== undefined && chosen.length >= max;

  function move(index: number, by: number) {
    const to = index + by;
    if (to < 0 || to >= chosen.length) return;
    const next = [...chosen];
    const [moved] = next.splice(index, 1);
    if (moved !== undefined) next.splice(to, 0, moved);
    setChosen(next);
  }

  return (
    <div>
      <input type="hidden" name={name} value={chosen.join(',')} />
      <ol className="space-y-2">
        {chosen.map((value, index) => (
          <li key={value} className="flex items-center gap-2 rounded-md border border-line bg-carbon px-3 py-2">
            <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-steel">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{labelOf(value)}</span>
            <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className={`${buttonClass('ghost', 'sm')} disabled:opacity-30`} aria-label={`Move ${labelOf(value)} up`}>
              <ArrowUp className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => move(index, 1)} disabled={index === chosen.length - 1} className={`${buttonClass('ghost', 'sm')} disabled:opacity-30`} aria-label={`Move ${labelOf(value)} down`}>
              <ArrowDown className="size-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setChosen(chosen.filter((item) => item !== value))} className={buttonClass('ghost', 'sm')} aria-label={`Remove ${labelOf(value)}`}>
              <X className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      {chosen.length === 0 && <p className="text-sm text-steel">Nothing chosen yet.</p>}
      {available.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {available.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={full}
              onClick={() => setChosen([...chosen, option.value])}
              className={`${buttonClass('secondary', 'sm')} disabled:opacity-30`}
            >
              <Plus className="size-3.5" aria-hidden="true" /> {option.label}
            </button>
          ))}
        </div>
      )}
      {full && <p className="mt-2 text-xs text-steel">That is the maximum of {max}. Remove one to add another.</p>}
    </div>
  );
}
