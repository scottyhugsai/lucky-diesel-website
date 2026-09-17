'use client';

import { Check } from 'lucide-react';
import { CHOICE_CARD } from './ui';

export interface Choice<T extends string> {
  value: T;
  label: string;
  hint?: string;
  meta?: string;
  disabled?: boolean;
}

interface ChoiceGroupProps<T extends string> {
  name: string;
  choices: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Fired for pointer taps only, so arrow-key browsing never jumps ahead. */
  onPick?: (value: T) => void;
  columns?: 1 | 2;
  labelledBy?: string;
}

/** Native radios styled as big tap targets: arrow keys, form semantics and screen readers work for free. */
export function ChoiceGroup<T extends string>({ name, choices, value, onChange, onPick, columns = 1, labelledBy = 'planner-heading' }: ChoiceGroupProps<T>) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={`grid gap-2.5 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
      {choices.map((choice, index) => (
        <label key={choice.value} className={`${CHOICE_CARD} ${choice.disabled ? 'opacity-60' : ''}`}>
          <input
            type="radio"
            name={name}
            value={choice.value}
            checked={value === choice.value}
            onChange={() => onChange(choice.value)}
            onClick={(event) => {
              if (event.detail > 0 && onPick) onPick(choice.value);
            }}
            className="peer sr-only"
          />
          <span
            className="display w-8 shrink-0 text-2xl text-steel/70 peer-checked:text-clover [[data-design=v2]_&]:hidden"
            aria-hidden="true"
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="min-w-0 flex-1">
            <span className="display block text-3xl not-italic leading-none [[data-design=v2]_&]:text-xl">{choice.label}</span>
            {choice.hint && <span className="mt-1.5 block text-sm text-chalk/65">{choice.hint}</span>}
          </span>
          {choice.meta && <span className="shrink-0 text-xs font-semibold text-steel">{choice.meta}</span>}
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-carbon transition-colors peer-checked:border-clover peer-checked:bg-clover"
            aria-hidden="true"
          >
            <Check className="size-4" strokeWidth={3} />
          </span>
        </label>
      ))}
    </div>
  );
}
