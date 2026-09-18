import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AutoSubmit } from './AutoSubmit';
import {
  type Fitment,
  MAKE_LABELS,
  YEARS,
  enginesFor,
  fitmentParams,
  makesFor,
  modelsFor,
} from '@/lib/fitment/select';

/**
 * Year → make → model → engine, as four links-with-options rather than a
 * JavaScript widget: each step is a plain <form method="get">, so the picker
 * works with JS switched off, every combination is a real URL that can be
 * shared and indexed, and the back button behaves.
 */

interface Option {
  value: string;
  label: string;
}

function Step({ index, name, label, options, value, fitment, disabled }: {
  index: number;
  name: 'year' | 'make' | 'model' | 'engine';
  label: string;
  options: readonly Option[];
  value: string | null;
  fitment: Fitment;
  disabled: boolean;
}) {
  // Steps after this one are dropped, so changing the year cannot leave a
  // model from a different truck behind.
  const order: ('year' | 'make' | 'model' | 'engine')[] = ['year', 'make', 'model', 'engine'];
  const keep = order.slice(0, order.indexOf(name));
  const carried = fitmentParams({ ...fitment, ...Object.fromEntries(order.map((key) => [key, keep.includes(key) ? fitment[key] : null])) } as Fitment);
  const state = value ? 'done' : disabled ? 'idle' : 'live';

  return (
    <div className="v4-step" data-state={state}>
      <form method="get" action="#fitment" className="flex items-center gap-3">
        {[...carried.entries()].map(([key, carriedValue]) => (
          <input key={key} type="hidden" name={key} value={carriedValue} />
        ))}
        <span
          aria-hidden="true"
          className="v4-step-num v4-num relative grid size-7 shrink-0 place-items-center rounded-full border text-xs text-steel"
        >
          {index}
        </span>
        <label className="sr-only" htmlFor={`fitment-${name}`}>{label}</label>
        <select
          id={`fitment-${name}`}
          name={name}
          defaultValue={value ?? ''}
          disabled={disabled}
          className="v4-field min-h-12 w-full px-3"
        >
          <option value="">{disabled ? `${label} —` : label}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {/* Submits the step for anyone without JS; enhanced to auto-submit below. */}
        <noscript>
          <button type="submit" className="v4-field min-h-12 px-3 text-sm font-semibold">Go</button>
        </noscript>
      </form>
    </div>
  );
}

export function FitmentPicker({ fitment, action = '#fitment' }: { fitment: Fitment; action?: string }) {
  const years: Option[] = YEARS.map((year) => ({ value: String(year), label: String(year) }));
  const makes: Option[] = fitment.year ? makesFor(fitment.year).map((make) => ({ value: make.id, label: make.label })) : [];
  const models: Option[] = fitment.year && fitment.make
    ? modelsFor(fitment.year, fitment.make).map((model) => ({ value: model.id, label: model.model }))
    : [];
  const engines: Option[] = fitment.year && fitment.make && fitment.model
    ? enginesFor(fitment.year, fitment.make, fitment.model).map((engine) => ({ value: engine.id, label: engine.name }))
    : [];

  void action;
  return (
    <section aria-labelledby="fitment-heading" id="fitment" className="v4-panel v4-panel-live v4-panel-enter scroll-mt-20 p-5 sm:p-6">
      <h2 id="fitment-heading" className="v4-title text-2xl">Pick your truck</h2>
      <p className="mt-1.5 text-sm text-steel">Four taps. We show you what fits.</p>

      <AutoSubmit selector="#fitment" />
      <div className="mt-5 grid gap-2.5">
        <Step index={1} name="year" label="Year" options={years} value={fitment.year ? String(fitment.year) : null} fitment={fitment} disabled={false} />
        <Step index={2} name="make" label="Make" options={makes} value={fitment.make} fitment={fitment} disabled={!fitment.year} />
        <Step index={3} name="model" label="Model" options={models} value={fitment.model} fitment={fitment} disabled={!fitment.make} />
        <Step index={4} name="engine" label="Engine" options={engines} value={fitment.engine} fitment={fitment} disabled={!fitment.model} />
      </div>

      {fitment.engine ? (
        <Link href={`/fitment?${fitmentParams(fitment).toString()}`} className="btn-go v4-go mt-5 flex min-h-12 items-center justify-center gap-2 px-6 font-bold">
          Show what fits <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <p className="mt-5 flex min-h-12 items-center justify-center rounded-[2px] border border-dashed border-line px-4 text-center text-sm text-steel">
          {fitment.year
            ? `${[fitment.year, fitment.make ? MAKE_LABELS[fitment.make] : null].filter(Boolean).join(' ')} — keep going`
            : 'Start with the year'}
        </p>
      )}
    </section>
  );
}
