'use client';

import { Check, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { bookOnline, type BookingState } from '@/app/(site)/book/actions';
import { ReferFriendPrompt } from '@/components/marketing-public/ReferFriendPrompt';
import { Field, inputClass } from '@/components/quote/Field';
import { SMS_CONSENT_TEXT } from '@/lib/lead';
import { OTHER_PLATFORM, PLATFORMS, SERVICES } from '@/lib/site';

interface BookingDate {
  value: string;
  weekday: string;
  day: string;
  month: string;
}

interface SlotOption {
  startsAt: string;
  label: string;
}

export function BookingForm({ dates }: { dates: BookingDate[] }) {
  const [state, action, isPending] = useActionState<BookingState, FormData>(bookOnline, {});
  const [date, setDate] = useState(dates[0]?.value ?? '');
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [startsAt, setStartsAt] = useState('');
  const [platformId, setPlatformId] = useState('');
  const platform = PLATFORMS.find((p) => p.id === platformId);

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    fetch(`/api/slots?date=${date}`, { signal: controller.signal })
      .then((response) => response.json() as Promise<{ slots: SlotOption[] }>)
      .then((data) => {
        // Late in the day, today has nothing left: move on to the next open day instead of showing an empty list.
        const index = dates.findIndex((d) => d.value === date);
        if (data.slots.length === 0 && index === 0 && dates[1]) {
          setDate(dates[1].value);
          return;
        }
        setSlots(data.slots);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setSlots([]);
      });
    return () => controller.abort();
  }, [date, dates]);

  if (state.ok && state.confirmation) {
    return (
      <div role="status" className="grid gap-4 py-6">
        <span className="grid size-14 place-items-center rounded-full bg-clover text-carbon"><Check className="size-7" aria-hidden="true" /></span>
        <h2 className="display text-5xl">You’re booked{state.confirmation.firstName ? `, ${state.confirmation.firstName}` : ''}.</h2>
        <p className="text-lg text-chalk/75">
          {state.confirmation.service} on <strong className="text-chalk">{state.confirmation.when}</strong>. A confirmation is on its way.
        </p>
        <ReferFriendPrompt />
        <Link href="/" className="font-semibold text-clover">Back to the site</Link>
      </div>
    );
  }

  const errors = state.errors ?? {};

  return (
    <form action={action} className="grid gap-6">
      <fieldset className="min-w-0">
        <legend className="mb-3 text-sm font-semibold text-chalk/85">1. Pick a day</legend>
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
          {dates.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={date === option.value}
              onClick={() => { setDate(option.value); setSlots(null); setStartsAt(''); }}
              className={`flex w-16 shrink-0 snap-start flex-col items-center rounded-sm border py-2 transition-colors ${date === option.value ? 'border-clover bg-clover text-carbon' : 'border-line bg-carbon hover:border-chalk/40'}`}
            >
              <span className="text-xs font-semibold uppercase">{option.weekday}</span>
              <span className="display text-3xl not-italic leading-none">{option.day}</span>
              <span className="text-xs">{option.month}</span>
            </button>
          ))}
        </div>
        <input type="hidden" name="date" value={date} />
      </fieldset>

      <fieldset className="min-w-0" aria-describedby={errors.slot ? 'error-slot' : undefined}>
        <legend className="mb-3 text-sm font-semibold text-chalk/85">2. Pick a time</legend>
        {slots === null ? (
          <p className="flex items-center gap-2 text-sm text-steel"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Checking the schedule…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-steel">No open times that day. Try another day.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((slot) => (
              <button
                key={slot.startsAt}
                type="button"
                aria-pressed={startsAt === slot.startsAt}
                onClick={() => setStartsAt(slot.startsAt)}
                className={`h-11 rounded-sm border text-sm font-semibold tabular-nums transition-colors ${startsAt === slot.startsAt ? 'border-clover bg-clover text-carbon' : 'border-line bg-carbon hover:border-chalk/40'}`}
              >
                {slot.label}
              </button>
            ))}
          </div>
        )}
        <input type="hidden" name="startsAt" value={startsAt} />
        {errors.slot && <p id="error-slot" className="mt-2 text-sm text-danger">{errors.slot}</p>}
      </fieldset>

      <fieldset className="grid min-w-0 gap-5">
        <legend className="mb-1 text-sm font-semibold text-chalk/85">3. Your truck & the work</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[...PLATFORMS.map((p) => ({ id: p.id as string, label: p.name })), { id: OTHER_PLATFORM as string, label: 'Other' }].map((option) => (
            <label key={option.id}>
              <input type="radio" name="platform" value={option.id} checked={platformId === option.id} onChange={() => setPlatformId(option.id)} className="peer sr-only" />
              <span className="display flex h-12 cursor-pointer items-center justify-center rounded-sm border border-line bg-carbon text-xl not-italic peer-checked:border-clover peer-checked:bg-clover peer-checked:text-carbon peer-focus-visible:outline-2 peer-focus-visible:outline-clover">
                {option.label}
              </span>
            </label>
          ))}
        </div>
        {errors.platform && <p className="text-sm text-danger">{errors.platform}</p>}
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          {platform && (
            <Field id="generation" label={`${platform.name} engine`} error={errors.generation} optional>
              <select id="field-generation" name="generation" className={inputClass(errors.generation)} defaultValue="">
                <option value="">Not sure</option>
                {platform.generations.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
          )}
          <Field id="mileage" label="Mileage" optional className={platform ? '' : 'sm:col-span-2'}>
            <input id="field-mileage" name="mileage" inputMode="numeric" maxLength={20} className={inputClass()} />
          </Field>
        </div>
        <Field id="service" label="Service" error={errors.service}>
          <select id="field-service" name="service" defaultValue="" className={inputClass(errors.service)}>
            <option value="" disabled>Pick a service</option>
            {SERVICES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field id="details" label="Anything we should know?" optional>
          <textarea id="field-details" name="details" rows={3} maxLength={2000} className={`${inputClass()} h-auto py-3`} />
        </Field>
      </fieldset>

      <fieldset className="grid min-w-0 gap-5 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-chalk/85 sm:col-span-2">4. Your info</legend>
        <Field id="name" label="Name" error={errors.name} className="sm:col-span-2">
          <input id="field-name" name="name" autoComplete="name" className={inputClass(errors.name)} />
        </Field>
        <Field id="phone" label="Phone" error={errors.phone}>
          <input id="field-phone" name="phone" type="tel" autoComplete="tel" className={inputClass(errors.phone)} />
        </Field>
        <Field id="email" label="Email" error={errors.email}>
          <input id="field-email" name="email" type="email" autoComplete="email" className={inputClass(errors.email)} />
        </Field>
      </fieldset>

      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <input tabIndex={-1} autoComplete="off" name="company" />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-line bg-carbon p-3 text-xs leading-relaxed text-chalk/65">
        <input type="checkbox" name="smsConsent" className="mt-0.5 size-4 shrink-0 accent-[var(--clover)]" />
        <span>{SMS_CONSENT_TEXT} <Link href="/privacy" className="underline underline-offset-2 hover:text-clover">Privacy</Link></span>
      </label>

      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {Object.keys(errors).length > 0 && <p role="alert" className="text-sm text-danger">Check the highlighted fields.</p>}

      <button type="submit" disabled={isPending} className="btn-go display flex h-15 items-center justify-center gap-3 rounded-sm text-2xl not-italic disabled:opacity-80">
        {isPending && <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />}
        {isPending ? 'Booking…' : 'Book it'}
      </button>
    </form>
  );
}
