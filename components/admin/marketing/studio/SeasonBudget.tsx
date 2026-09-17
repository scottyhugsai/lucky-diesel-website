import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import type { ActionState } from '@/components/admin/core/parse';
import { Badge, fieldClass } from '@/components/app/ui';
import { money } from '@/lib/format';
import { SEASON_MULTIPLIER_RANGE } from '@/lib/marketing/content/budget';
import type { ProposalView } from '@/lib/marketing/content/budget-service';

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface SeasonBudgetProps {
  multipliers: Record<number, number>;
  proposals: readonly ProposalView[];
  saveAction: Action;
  proposeAction: Action;
  decideAction: Action;
}

/**
 * Month multipliers plus the queue of proposed budget changes. Nothing moves
 * until the owner approves the exact new daily amount.
 */
export function SeasonBudget({ multipliers, proposals, saveAction, proposeAction, decideAction }: SeasonBudgetProps) {
  return (
    <div className="grid gap-4">
      <ActionForm action={saveAction} className="grid gap-3" aria-label="Season multipliers">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {MONTHS.map((label, i) => (
            <label key={label} className="text-xs text-steel">
              {label}
              <input
                name={`m${i + 1}`}
                inputMode="decimal"
                defaultValue={String(multipliers[i + 1] ?? 1)}
                min={SEASON_MULTIPLIER_RANGE.min}
                max={SEASON_MULTIPLIER_RANGE.max}
                className={`${fieldClass} mt-1 h-9 tabular-nums`}
                required
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <PendingButton size="sm" variant="secondary">Save months</PendingButton>
        </div>
      </ActionForm>

      <ActionForm action={proposeAction}>
        <PendingButton size="sm">Propose next month</PendingButton>
      </ActionForm>

      {proposals.length > 0 && (
        <ul className="grid gap-2 border-t border-line pt-3">
          {proposals.map((p) => (
            <li key={p.id} className="rounded-sm border border-line bg-carbon p-3">
              <p className="text-sm font-semibold">{p.campaign} · {p.month}</p>
              <p className="text-sm text-chalk/70 tabular-nums">
                {money(p.fromCents)} → {money(p.toCents)}/day <Badge tone="info">×{p.multiplier}</Badge>
              </p>
              {p.error && <p className="mt-1 text-sm text-danger">{p.error}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <ActionForm action={decideAction} confirm={`Change to ${money(p.toCents)}/day?`}>
                  <input type="hidden" name="proposalId" value={p.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <PendingButton size="sm">Approve</PendingButton>
                </ActionForm>
                <ActionForm action={decideAction}>
                  <input type="hidden" name="proposalId" value={p.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <PendingButton size="sm" variant="secondary">Reject</PendingButton>
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
