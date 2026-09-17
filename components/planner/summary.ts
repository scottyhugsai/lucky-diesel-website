import { money } from '@/lib/format';
import { budgetName, goalName } from './options';
import type { Plan } from './recommend';
import { truckLabel, type PlannerState } from './state';

export const MAX_DETAILS = 2000;

const EMISSIONS_TEXT = { offroad: 'off-road use only', compliant: 'emissions-compliant', confirm: 'emissions status to confirm' } as const;

/** Plain-text plan for the lead's `details` field. Always ≤ 2000 characters. */
export function planDetails(state: PlannerState, plan: Plan | null): string {
  const head = [
    'Build planner request',
    `Truck: ${truckLabel(state)}${state.miles ? ` · ${Number(state.miles).toLocaleString('en-US')} mi` : ''}`,
    `Goal: ${goalName(state.goal) || 'Not set'} · Budget: ${budgetName(state.budget)}`,
  ];
  if (!plan || !plan.stages.length) {
    return [...head, 'No listed parts fit this truck yet. Please advise on options.'].join('\n');
  }
  const parts = plan.stages.flatMap((stage, index) => [
    `Stage ${index + 1} ${stage.name}:`,
    ...stage.picks.map((pick) => {
      const variant = pick.variant.title ? ` (${pick.variant.title})` : '';
      const fit = pick.fit === 'platform' ? ', confirm fit' : '';
      return `- ${pick.product.title}${variant}: ${money(pick.variant.priceCents)} [${EMISSIONS_TEXT[pick.emissions]}${fit}]`;
    }),
  ]);
  const tail = [
    `Parts subtotal: ${money(plan.subtotalCents)} (install labor to be quoted)`,
    ...(plan.supporting.length ? [`Supporting mods to discuss: ${plan.supporting.join(', ')}`] : []),
  ];

  const lines = [...head, ...parts, ...tail];
  const full = lines.join('\n');
  if (full.length <= MAX_DETAILS) return full;
  const reserved = tail.join('\n').length + 3;
  const body = [...head, ...parts].join('\n').slice(0, MAX_DETAILS - reserved - 1).trimEnd();
  return `${body}…\n${tail.join('\n')}`.slice(0, MAX_DETAILS);
}
