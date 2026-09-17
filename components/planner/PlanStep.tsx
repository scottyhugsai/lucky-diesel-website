'use client';

import Link from 'next/link';
import { Pencil, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { money } from '@/lib/format';
import { budgetName, goalName, type StepId } from './options';
import { CatalogDown, NoFitment } from './PlanEmpty';
import type { Navigate } from './Planner';
import { PickCard } from './PickCard';
import { PlanSummary } from './PlanSummary';
import type { PlannerProduct } from './product';
import { recommend } from './recommend';
import { truckLabel, type PlannerState } from './state';
import { BADGE, SURFACE } from './ui';

interface PlanStepProps {
  state: PlannerState;
  products: PlannerProduct[] | null;
  catalogOk: boolean;
  onNavigate: Navigate;
}

export function PlanStep({ state, products, catalogOk, onNavigate }: PlanStepProps) {
  const plan = useMemo(() => {
    if (!products || !state.platform || !state.gen || !state.goal) return null;
    return recommend({ products, truck: { platform: state.platform, generationCollection: state.gen }, goal: state.goal, budget: state.budget, overrides: state.picks });
  }, [products, state]);

  if (!catalogOk) return <CatalogDown />;
  if (!plan) return <p role="status" className="text-steel">Loading parts for your truck…</p>;
  if (!plan.hasFitment) return <NoFitment state={state} />;

  const edit = (step: StepId) => onNavigate({ ...state, step });
  const chips: [string, string, StepId][] = [
    ['Truck', truckLabel(state), 'generation'],
    ['Goal', goalName(state.goal), 'goal'],
    ['Budget', budgetName(state.budget), 'budget'],
  ];

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
      <div className="grid min-w-0 gap-10">
        <ul className="-mt-2 flex flex-wrap gap-2" aria-label="Your answers">
          {chips.map(([label, value, step]) => (
            <li key={label}>
              <button type="button" onClick={() => edit(step)} className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-line px-3 text-sm transition-colors hover:border-clover [[data-design=v2]_&]:rounded-full">
                <span className="text-steel">{label}</span>
                <span className="font-semibold">{value}</span>
                <Pencil className="size-3.5 text-steel" aria-hidden="true" />
                <span className="sr-only">Change {label.toLowerCase()}</span>
              </button>
            </li>
          ))}
        </ul>

        {plan.notes.map((note) => <p key={note} className="-mt-4 text-sm text-chalk/70">{note}</p>)}

        {plan.stages.length === 0 && (
          <p className={`${SURFACE} p-5 text-chalk/80`}>Nothing we list fits that budget yet. Raise it, or get a quote and we’ll find a way.</p>
        )}

        {plan.stages.map((stage, index) => (
          <section key={stage.id} aria-labelledby={`stage-${stage.id}`} className="grid gap-3">
            <h2 id={`stage-${stage.id}`} className="flex items-baseline gap-3">
              <span className="kicker">Stage {index + 1}</span>
              <span className="display text-4xl [[data-design=v2]_&]:text-2xl">{stage.name}</span>
            </h2>
            <ul className="grid gap-3">
              {stage.picks.map((pick) => (
                <li key={pick.slot}>
                  <PickCard pick={pick} onSwap={(variantId) => onNavigate({ ...state, picks: { ...state.picks, [pick.slot]: variantId } }, { replace: true })} />
                </li>
              ))}
            </ul>
          </section>
        ))}

        {plan.skipped.length > 0 && (
          <section aria-labelledby="stage-later" className="grid gap-3">
            <h2 id="stage-later" className="kicker">Over budget, for later</h2>
            <ul className="grid gap-2 text-sm text-chalk/75">
              {plan.skipped.map((s) => (
                <li key={s.slot} className="flex justify-between gap-4 border-b border-line pb-2">
                  <span><span className="text-steel">{s.slotName}:</span> {s.title}</span>
                  <span className="shrink-0 tabular-nums">{money(s.priceCents)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="supporting" className="grid gap-3">
          <h2 id="supporting" className="kicker">Supporting mods to discuss</h2>
          <ul className="flex flex-wrap gap-2">
            {plan.supporting.map((mod) => <li key={mod} className={`${BADGE} border-line py-1.5 text-chalk/80`}>{mod}</li>)}
          </ul>
        </section>

        <p className="flex gap-3 border-t border-line pt-6 text-sm text-chalk/70">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-clover" aria-hidden="true" />
          <span>
            Each part shows its emissions status. Street-driven trucks should run emissions-compliant parts and tunes.{' '}
            <Link href="/emissions-policy" className="font-semibold text-chalk underline underline-offset-4 hover:text-clover">Emissions policy</Link>
          </span>
        </p>
      </div>

      <PlanSummary state={state} plan={plan} />
    </div>
  );
}
