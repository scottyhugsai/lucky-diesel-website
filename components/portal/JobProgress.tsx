import { Check } from 'lucide-react';
import type { Enums } from '@/lib/db/database.types';
import { CUSTOMER_TIMELINE, WORK_ORDER_STATUS } from '@/lib/format';

type Status = Enums<'work_order_status'>;

/** Where each status sits on the six-step customer timeline. */
const STEP_INDEX: Record<Status, number> = {
  estimate: 0,
  awaiting_approval: 1,
  approved: 2,
  in_progress: 2,
  waiting_parts: 2,
  quality_check: 3,
  ready: 4,
  invoiced: 4,
  paid: 5,
  cancelled: 0,
};

function stepLabel(step: Status, index: number, current: number, status: Status): string {
  if (index === current) return WORK_ORDER_STATUS[status].customerLabel;
  if (step === 'awaiting_approval' && index < current) return 'Approved';
  return WORK_ORDER_STATUS[step].customerLabel;
}

/** Segmented progress bar with step labels. On phones only the current step is spelled out. */
export function JobProgress({ status, className = '' }: { status: Status; className?: string }) {
  const current = STEP_INDEX[status];
  const done = status === 'paid';
  const label = WORK_ORDER_STATUS[status].customerLabel;
  return (
    <div className={className}>
      <p className="sr-only">
        Step {current + 1} of {CUSTOMER_TIMELINE.length}: {label}
      </p>
      <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${CUSTOMER_TIMELINE.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {CUSTOMER_TIMELINE.map((step, index) => {
          const isPast = index < current || done;
          const isCurrent = index === current && !done;
          return (
            <li key={step} className="min-w-0">
              <span
                className={`block h-2 rounded-[2px] ${isPast ? 'bg-clover' : isCurrent ? 'bg-clover/25 ring-1 ring-clover' : 'bg-gunmetal'} ${isCurrent ? 'relative overflow-hidden after:absolute after:inset-y-0 after:left-0 after:w-1/2 after:bg-clover' : ''}`}
              />
              <span className={`mt-2 hidden items-start gap-1 text-xs font-semibold leading-tight sm:flex ${isCurrent ? 'text-chalk' : isPast ? 'text-chalk/60' : 'text-steel/70'}`}>
                {isPast && <Check className="mt-px size-3 shrink-0 text-clover" />}
                {stepLabel(step, index, current, status)}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2.5 flex items-center justify-between text-sm sm:hidden" aria-hidden="true">
        <span className="font-semibold text-chalk">{label}</span>
        <span className="tabular-nums text-steel">
          {Math.min(current + 1, CUSTOMER_TIMELINE.length)}/{CUSTOMER_TIMELINE.length}
        </span>
      </p>
    </div>
  );
}
