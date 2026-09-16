'use client';

import { useEffect, useState } from 'react';
import type { DemoState } from '@/app/admin/automations/actions';

const VISIBLE_MS = 7000;

/** Floating summary after a demo action. The live region stays mounted for screen readers. */
export function DemoToast({ state }: { state: DemoState }) {
  const [hiddenAt, setHiddenAt] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!state.at) return;
    const timer = window.setTimeout(() => setHiddenAt(state.at), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [state.at]);

  const visible = Boolean(state.at) && hiddenAt !== state.at;
  const { summary } = state;

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex justify-center lg:bottom-8 lg:left-auto lg:right-8 lg:justify-end">
      {visible && (
        <div className={`pointer-events-auto w-full max-w-sm rounded-md border bg-carbon-2/95 p-4 shadow-2xl backdrop-blur ${state.error ? 'border-danger/50' : 'border-violet/60'}`}>
          <p className={`text-sm font-bold ${state.error ? 'text-danger' : 'text-violet-200'}`}>{state.error ?? state.notice}</p>
          {summary && (
            <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
              {([['Processed', summary.processed, 'text-chalk'], ['Sent', summary.sent, 'text-clover'], ['Skipped', summary.skipped, 'text-amber-300'], ['Failed', summary.failed, 'text-danger']] as const).map(([label, value, tone]) => (
                <div key={label} className="rounded-sm border border-line bg-carbon px-1 py-2">
                  <dd className={`display text-2xl not-italic tabular-nums ${tone}`}>{value}</dd>
                  <dt className="text-[0.6rem] font-bold uppercase tracking-widest text-steel">{label}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
