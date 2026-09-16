'use client';

import { CircleStop, Timer } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';
import { clockOut } from '@/app/shop/actions';
import type { ActionState } from '@/app/shop/_lib/form';
import { SubmitButton } from '@/components/app/SubmitButton';
import { ElapsedTimer } from './ElapsedTimer';
import { FormMessage } from './FormMessage';

export interface BannerEntry {
  id: string;
  startedAt: string;
  workOrderId: string;
  number: number;
  title: string;
  vehicle: string;
}

/** Top-of-board clock status: what I'm on, how long, and a big way off. */
export function ClockBanner({ entry, serverNow }: { entry: BannerEntry | null; serverNow: number }) {
  const [state, action] = useActionState<ActionState, FormData>(clockOut, {});

  if (!entry) {
    return (
      <section aria-label="Clock status" className="flex items-center gap-3 rounded-md border border-line bg-carbon-2 px-4 py-3">
        <Timer className="size-5 text-steel" aria-hidden="true" />
        <p className="text-sm text-chalk/70"><strong className="text-chalk">Off the clock.</strong> Open a job to clock in.</p>
        <FormMessage state={state} className="ml-auto" />
      </section>
    );
  }

  return (
    <section aria-label="Clock status" className="relative overflow-hidden rounded-md border border-clover/40 bg-linear-to-br from-clover/15 via-carbon-2 to-carbon-2">
      <div className="speed-stripes pointer-events-none absolute -right-10 top-0 h-full w-40 opacity-10" aria-hidden="true" />
      <form action={action} className="relative grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
        <input type="hidden" name="entryId" value={entry.id} />
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-clover">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-clover opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-clover" />
            </span>
            On the clock
          </p>
          <ElapsedTimer startedAt={entry.startedAt} serverNow={serverNow} className="display mt-2 block text-6xl not-italic text-chalk" />
          <Link href={`/shop/jobs/${entry.workOrderId}`} className="mt-2 block truncate text-sm text-chalk/75 underline-offset-4 hover:text-clover hover:underline">
            <strong className="text-chalk">WO #{entry.number}</strong> · {entry.title} · {entry.vehicle}
          </Link>
        </div>
        <SubmitButton variant="danger" pendingLabel="Stopping…" className="h-14 w-full px-6 text-lg sm:w-auto">
          <CircleStop className="size-5" aria-hidden="true" /> Clock out
        </SubmitButton>
        <FormMessage state={state} className="sm:col-span-2" />
      </form>
    </section>
  );
}
