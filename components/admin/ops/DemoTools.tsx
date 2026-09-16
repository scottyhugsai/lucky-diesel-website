'use client';

import { useActionState, useState } from 'react';
import { FastForward, FlaskConical, Mail, Play, Wrench } from 'lucide-react';
import { SubmitButton } from '@/components/app/SubmitButton';
import { fastForward, runDueNow, sendDailySummary, simulateServiceDue, type DemoState } from '@/app/admin/automations/actions';
import { fieldClass, labelClass } from '@/components/app/ui';
import { DemoToast } from './DemoToast';

export interface DemoCustomer {
  id: string;
  name: string;
  vehicles: { id: string; label: string }[];
}

const INITIAL: DemoState = {};

/** Presenter-only controls that make time-based automations visible on stage. Violet = demo. */
export function DemoTools({ customers }: { customers: DemoCustomer[] }) {
  const [runState, runAction] = useActionState(runDueNow, INITIAL);
  const [ffState, ffAction] = useActionState(fastForward, INITIAL);
  const [summaryState, summaryAction] = useActionState(sendDailySummary, INITIAL);
  const [dueState, dueAction] = useActionState(simulateServiceDue, INITIAL);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const vehicles = customers.find((c) => c.id === customerId)?.vehicles ?? [];

  const latest = [runState, ffState, summaryState, dueState].reduce<DemoState>((a, b) => ((b.at ?? 0) > (a.at ?? 0) ? b : a), INITIAL);
  const violetBtn = 'inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-violet/60 bg-violet/15 px-3 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet/30 disabled:opacity-60';

  return (
    <section aria-labelledby="demo-tools-heading" className="relative overflow-hidden rounded-md border border-violet/50 bg-[linear-gradient(135deg,rgb(107_44_245/0.16),rgb(18_22_20/0.9)_55%)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="demo-tools-heading" className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
          <FlaskConical className="size-4" aria-hidden="true" /> Demo tools
        </h2>
        <span className="text-xs text-violet-200/70">Presenter only. Moves time forward so delayed messages fire on stage.</span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="flex flex-wrap gap-2">
          <form action={runAction}>
            <SubmitButton size="sm" variant="ghost" className={violetBtn} pendingLabel="Running…">
              <Play className="size-4" aria-hidden="true" /> Run due now
            </SubmitButton>
          </form>
          {[1, 3].map((days) => (
            <form key={days} action={ffAction}>
              <input type="hidden" name="days" value={days} />
              <SubmitButton size="sm" variant="ghost" className={violetBtn} pendingLabel="Fast-forwarding…">
                <FastForward className="size-4" aria-hidden="true" /> Fast-forward {days} day{days === 1 ? '' : 's'}
              </SubmitButton>
            </form>
          ))}
          <form action={summaryAction}>
            <SubmitButton size="sm" variant="ghost" className={violetBtn} pendingLabel="Sending…">
              <Mail className="size-4" aria-hidden="true" /> Send owner daily summary
            </SubmitButton>
          </form>
        </div>

        <form action={dueAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="demo-customer" className={`${labelClass} text-violet-100/80`}>Customer</label>
            <select id="demo-customer" name="customer_id" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={`${fieldClass} h-10 focus:border-violet focus:ring-violet/30`}>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="demo-vehicle" className={`${labelClass} text-violet-100/80`}>Truck</label>
            <select id="demo-vehicle" name="vehicle_id" key={customerId} className={`${fieldClass} h-10 focus:border-violet focus:ring-violet/30`}>
              {vehicles.length ? vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>) : <option value="">No trucks on file</option>}
            </select>
          </div>
          <SubmitButton size="sm" variant="ghost" className={violetBtn} pendingLabel="Sending…">
            <Wrench className="size-4" aria-hidden="true" /> Simulate service due
          </SubmitButton>
        </form>
      </div>

      <DemoToast state={latest} />
    </section>
  );
}
