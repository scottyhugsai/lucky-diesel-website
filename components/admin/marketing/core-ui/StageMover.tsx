'use client';

import { useActionState, useState } from 'react';
import { moveLeadStageAction } from '@/app/admin/marketing/contacts/actions';
import type { ActionState } from '@/components/admin/ops/form';

const LOST_REASONS = ['Price', 'Timing', 'Went elsewhere', 'No response', 'Not a fit'];

interface StageMoverProps {
  leadId: string;
  currentStageId: string | null;
  stages: { id: string; name: string; isLost: boolean }[];
}

/** Compact “move to” control on a pipeline card. Asks for a reason when moving to Lost. */
export function StageMover({ leadId, currentStageId, stages }: StageMoverProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(moveLeadStageAction, {});
  const [target, setTarget] = useState(currentStageId ?? '');
  const lost = stages.find((s) => s.id === target)?.isLost ?? false;
  const changed = target && target !== currentStageId;

  return (
    <form action={action} className="mt-2 grid gap-1.5">
      <input type="hidden" name="lead_id" value={leadId} />
      <label className="sr-only" htmlFor={`stage-${leadId}`}>Move lead</label>
      <div className="flex gap-1.5">
        <select id={`stage-${leadId}`} name="stage_id" value={target} onChange={(e) => setTarget(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-sm border border-line bg-carbon px-2 text-xs text-chalk focus:border-clover focus:outline-none">
          {!currentStageId && <option value="">Unstaged</option>}
          {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {changed && (
          <button type="submit" disabled={pending} className="h-8 rounded-sm bg-clover px-2.5 text-xs font-bold text-carbon disabled:opacity-60">
            {pending ? '…' : 'Move'}
          </button>
        )}
      </div>
      {lost && changed && (
        <select name="lost_reason" required defaultValue="" aria-label="Lost reason" className="h-8 rounded-sm border border-danger/40 bg-carbon px-2 text-xs text-chalk">
          <option value="" disabled>Why lost?</option>
          {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      )}
      {state.error && <p role="alert" className="text-xs font-semibold text-danger">{state.error}</p>}
    </form>
  );
}
