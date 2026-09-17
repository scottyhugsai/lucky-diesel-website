'use client';

import { CheckCircle2 } from 'lucide-react';
import { useActionState } from 'react';
import { registerForEvent, type RegisterState } from '@/app/(site)/events/[id]/actions';

const inputClass = 'h-12 w-full rounded-sm border border-line bg-carbon px-3 text-base text-chalk placeholder:text-steel/70 focus:border-clover focus:outline-none focus:ring-2 focus:ring-clover/30 [[data-design=v2]_&]:rounded-lg';
const labelClass = 'mb-1.5 block text-sm font-semibold text-chalk/85';

export function EventRegisterForm({ eventId, isFull }: { eventId: string; isFull: boolean }) {
  const [state, action, isPending] = useActionState<RegisterState, FormData>(registerForEvent, {});

  if (state.status) {
    return (
      <div role="status" className="grid gap-2 rounded-md border border-clover/40 bg-clover/10 p-5 [[data-design=v2]_&]:rounded-2xl">
        <p className="display flex items-center gap-2 text-2xl not-italic"><CheckCircle2 className="size-6 text-clover" aria-hidden="true" />{state.status === 'waitlist' ? 'You’re on the waitlist' : 'You’re in'}</p>
        <p className="text-chalk/80">{state.status === 'waitlist' ? `Thanks, ${state.name}. We’ll call if a spot opens.` : `See you there, ${state.name}. We’ll call if anything changes.`}</p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" aria-label="Sign up">
      <input type="hidden" name="event_id" value={eventId} />
      <div>
        <label htmlFor="ev-name" className={labelClass}>Name</label>
        <input id="ev-name" name="name" required autoComplete="name" className={inputClass} />
      </div>
      <div>
        <label htmlFor="ev-phone" className={labelClass}>Phone</label>
        <input id="ev-phone" name="phone" type="tel" required autoComplete="tel" className={inputClass} />
      </div>
      <div>
        <label htmlFor="ev-email" className={labelClass}>Email <span className="font-normal text-steel">(optional)</span></label>
        <input id="ev-email" name="email" type="email" autoComplete="email" className={inputClass} />
      </div>
      <div>
        <label htmlFor="ev-platform" className={labelClass}>Truck</label>
        <select id="ev-platform" name="platform" required defaultValue="" className={inputClass}>
          <option value="" disabled>Pick one</option>
          <option value="duramax">Duramax</option>
          <option value="powerstroke">Powerstroke</option>
          <option value="cummins">Cummins</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="ev-vehicle" className={labelClass}>Year, model, mods <span className="font-normal text-steel">(optional)</span></label>
        <input id="ev-vehicle" name="vehicle" maxLength={120} placeholder="2019 L5P, tuned, 4in exhaust" className={inputClass} />
      </div>
      <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex items-start gap-2 text-sm text-chalk/75 sm:col-span-2">
        <input type="checkbox" name="media" className="mt-0.5 size-4 shrink-0 accent-clover" />
        OK to film my truck’s pull for social media.
      </label>
      {state.error && <p role="alert" className="text-sm font-semibold text-danger sm:col-span-2">{state.error}</p>}
      <button type="submit" disabled={isPending} className="btn-go display h-12 rounded-sm text-lg not-italic disabled:opacity-60 sm:col-span-2 sm:w-fit sm:px-8 [[data-design=v2]_&]:rounded-full">
        {isPending ? 'Saving…' : isFull ? 'Join waitlist' : 'Save my spot'}
      </button>
    </form>
  );
}
