'use client';

import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { ChoiceGroup } from './ChoiceGroup';
import { BUDGETS, GOALS, type BudgetId, type GoalId } from './options';
import type { Navigate } from './Planner';
import type { PlannerState } from './state';
import { BTN_GHOST, BTN_PRIMARY } from './ui';

const PICK_DELAY_MS = 180;

interface StepProps {
  state: PlannerState;
  onNavigate: Navigate;
}

export function GoalStep({ state, onNavigate }: StepProps) {
  const [goal, setGoal] = useState<GoalId | null>(state.goal);
  // A new goal means a new plan: drop any part swaps made for the old one.
  const next = (id: GoalId) => onNavigate({ ...state, goal: id, picks: id === state.goal ? state.picks : {}, step: 'budget' });

  return (
    <div className="grid gap-6">
      <ChoiceGroup
        name="goal"
        value={goal}
        onChange={setGoal}
        onPick={(id) => window.setTimeout(() => next(id), PICK_DELAY_MS)}
        columns={2}
        choices={GOALS.map((g) => ({ value: g.id, label: g.name, hint: g.line }))}
      />
      <button type="button" disabled={!goal} onClick={() => goal && next(goal)} className={`${BTN_PRIMARY} w-full sm:w-auto sm:justify-self-start`}>
        Continue <ArrowRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function BudgetStep({ state, onNavigate }: StepProps) {
  const [budget, setBudget] = useState<BudgetId | null>(state.budget);
  const next = (id: BudgetId | null) => onNavigate({ ...state, budget: id, step: 'plan' });

  return (
    <div className="grid gap-6">
      <p className="-mt-4 text-chalk/65">Parts only. Install is quoted by the shop.</p>
      <ChoiceGroup
        name="budget"
        value={budget}
        onChange={setBudget}
        onPick={(id) => window.setTimeout(() => next(id), PICK_DELAY_MS)}
        columns={2}
        choices={BUDGETS.map((b) => ({ value: b.id, label: b.name }))}
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" disabled={!budget} onClick={() => next(budget)} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
          Build my plan <ArrowRight className="size-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => next(null)} className={`${BTN_GHOST} w-full sm:w-auto`}>
          Skip
        </button>
      </div>
    </div>
  );
}
