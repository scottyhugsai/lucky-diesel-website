'use client';

import { useActionState, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { bookService, type BookState } from '@/app/portal/book/actions';
import { SubmitButton } from '@/components/app/SubmitButton';
import { fieldClass, labelClass } from '@/components/app/ui';
import { NOTES_MAX, type BookingDate } from './booking';

interface Option {
  id: string;
  label: string;
}

interface BookingFormProps {
  vehicles: Option[];
  services: Option[];
  dates: BookingDate[];
  selectedDate: string;
  slots: { startsAt: string; label: string }[];
  initialVehicle: string;
  initialService: string;
}

const chip = 'flex cursor-pointer items-center justify-center rounded-sm border text-sm font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-clover';

export function BookingForm({ vehicles, services, dates, selectedDate, slots, initialVehicle, initialService }: BookingFormProps) {
  const [state, action] = useActionState<BookState, FormData>(bookService, {});
  const [vehicleId, setVehicleId] = useState(initialVehicle);
  const [serviceId, setServiceId] = useState(initialService);
  const [isLoadingSlots, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  function pickDate(date: string) {
    const query = new URLSearchParams({ date, vehicle: vehicleId, service: serviceId });
    startTransition(() => router.replace(`${pathname}?${query}`, { scroll: false }));
  }

  return (
    <form action={action} className="space-y-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="vehicleId" className={labelClass}>Truck</label>
          <select id="vehicleId" name="vehicleId" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required className={fieldClass}>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="serviceId" className={labelClass}>Service</label>
          <select id="serviceId" name="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required className={fieldClass}>
            {services.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="min-w-0">
        <legend className={labelClass}>Day</legend>
        <input type="hidden" name="date" value={selectedDate} />
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 lg:grid-cols-10">
          {dates.map((d) => {
            const selected = d.value === selectedDate;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => pickDate(d.value)}
                aria-pressed={selected}
                className={`${chip} h-[4.5rem] w-16 shrink-0 snap-start flex-col gap-0.5 sm:w-auto ${selected ? 'border-clover bg-clover text-carbon' : 'border-line bg-carbon text-chalk/80 hover:border-chalk/30'}`}
              >
                <span className="text-[0.7rem] uppercase tracking-widest">{d.weekday}</span>
                <span className="display text-2xl not-italic leading-none">{d.day}</span>
                <span className="text-[0.7rem]">{d.month}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset aria-busy={isLoadingSlots} className="min-w-0">
        <legend className={labelClass}>Drop-off time</legend>
        <div aria-live="polite" className={isLoadingSlots ? 'opacity-50' : ''}>
          {slots.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {slots.map((slot) => (
                <label key={slot.startsAt} className={`${chip} h-12 border-line bg-carbon text-chalk/85 hover:border-chalk/30 has-[:checked]:border-clover has-[:checked]:bg-clover/15 has-[:checked]:text-clover`}>
                  <input type="radio" name="startsAt" value={slot.startsAt} required className="sr-only" />
                  {slot.label}
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-sm border border-dashed border-line px-4 py-6 text-center text-chalk/60">No openings left that day. Try another day.</p>
          )}
        </div>
      </fieldset>

      <div>
        <label htmlFor="notes" className={labelClass}>Anything we should know? <span className="font-normal text-steel">(optional)</span></label>
        <textarea id="notes" name="notes" rows={3} maxLength={NOTES_MAX} placeholder="Symptoms, parts you’ve bought, when you need it back…" className={`${fieldClass} h-auto py-2.5`} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton pendingLabel="Booking…" className="h-12 px-8 text-base">Book it</SubmitButton>
        <p role="status" aria-live="polite" className={`text-sm ${state.error ? 'text-danger' : 'font-semibold text-clover'}`}>{state.error ?? state.message}</p>
      </div>
    </form>
  );
}
