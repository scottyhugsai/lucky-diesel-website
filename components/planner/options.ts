/** Planner vocabulary shared by the server page, client steps and the rules. Pure — no React. */

export const GOALS = [
  { id: 'daily', name: 'Daily & reliable', line: 'Stock-feeling power that lasts.' },
  { id: 'tow', name: 'Tow heavy', line: 'Pull hard, run cool, shift right.' },
  { id: 'power', name: 'More power', line: 'A real bump you can feel.' },
  { id: 'allout', name: 'All-out build', line: 'Big fuel, big turbo, no half measures.' },
] as const;

export type GoalId = (typeof GOALS)[number]['id'];

export const BUDGETS = [
  { id: 'under-1500', name: 'Under $1.5k', capCents: 150_000 },
  { id: '1500-5000', name: '$1.5k – $5k', capCents: 500_000 },
  { id: '5000-10000', name: '$5k – $10k', capCents: 1_000_000 },
  { id: 'no-limit', name: 'No limit', capCents: null },
] as const;

export type BudgetId = (typeof BUDGETS)[number]['id'];

export const STEPS = [
  { id: 'platform', label: 'Truck' },
  { id: 'generation', label: 'Truck' },
  { id: 'goal', label: 'Goal' },
  { id: 'budget', label: 'Budget' },
  { id: 'plan', label: 'Plan' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

export const isGoal = (value: unknown): value is GoalId => GOALS.some((g) => g.id === value);
export const isBudget = (value: unknown): value is BudgetId => BUDGETS.some((b) => b.id === value);
export const isStep = (value: unknown): value is StepId => STEPS.some((s) => s.id === value);

export const goalName = (id: GoalId | null) => GOALS.find((g) => g.id === id)?.name ?? '';
export const budgetName = (id: BudgetId | null) => BUDGETS.find((b) => b.id === id)?.name ?? 'No budget set';
