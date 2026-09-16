import { CircleCheck, TriangleAlert } from 'lucide-react';
import type { ActionState } from '@/app/shop/_lib/form';

/** Result line for a shop form. Always rendered so screen readers hear updates. */
export function FormMessage({ state, className = '' }: { state: ActionState; className?: string }) {
  return (
    <p aria-live="polite" className={`text-sm font-semibold ${state.error ? 'text-danger' : 'text-clover'} ${className}`}>
      {state.error ? (
        <span className="inline-flex items-start gap-1.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </span>
      ) : state.notice ? (
        <span className="inline-flex items-start gap-1.5">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.notice}
        </span>
      ) : null}
    </p>
  );
}
