'use client';

import { useEffect, useState, useTransition } from 'react';
import { LoaderCircle } from 'lucide-react';
import { loadSlots, type SlotOption } from '@/app/admin/calendar/actions';
import { fieldClass, labelClass } from '@/components/app/ui';

const MAX_LOOKAHEAD_DAYS = 10;

function nextDate(date: string, days: number): string {
  return new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Date input plus a grid of open slots from the shop's real availability. Submits `date` and `starts_at`. */
export function SlotPicker({ initialDate, idPrefix = 'slot' }: { initialDate: string; idPrefix?: string }) {
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const [autoAdvance, setAutoAdvance] = useState(true);

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const result = await loadSlots(date);
      if (cancelled) return;
      // First visit only: if the starting day has nothing left, jump to the next day that does.
      if (autoAdvance && !result.slots.length && !result.error) {
        for (let offset = 1; offset <= MAX_LOOKAHEAD_DAYS; offset += 1) {
          const next = nextDate(date, offset);
          const ahead = await loadSlots(next);
          if (cancelled) return;
          if (ahead.slots.length) {
            setAutoAdvance(false);
            setDate(next);
            return;
          }
        }
      }
      setAutoAdvance(false);
      setSlots(result.slots);
      setSelected('');
      setMessage(result.error ?? (result.slots.length ? '' : 'No open times that day. The shop is closed or fully booked.'));
    });
    return () => { cancelled = true; };
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps -- autoAdvance only matters on the first load

  return (
    <div className="grid gap-3">
      <div>
        <label htmlFor={`${idPrefix}-date`} className={labelClass}>Date</label>
        <input id={`${idPrefix}-date`} name="date" type="date" required value={date} min={initialDate} onChange={(e) => { setAutoAdvance(false); setDate(e.target.value); }} className={`${fieldClass} max-w-xs`} />
      </div>
      <fieldset>
        <legend className={labelClass}>Open times</legend>
        <input type="hidden" name="starts_at" value={selected} />
        {pending ? (
          <p className="flex items-center gap-2 text-sm text-steel"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Checking the schedule…</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Open times">
            {slots.map((slot) => {
              const active = selected === slot.startsAt;
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(slot.startsAt)}
                  className={`h-10 rounded-sm border text-sm font-semibold tabular-nums transition-colors ${active ? 'border-clover bg-clover text-carbon' : 'border-line bg-carbon text-chalk hover:border-clover/60'}`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-sm text-steel" aria-live="polite">{pending ? '' : message}</p>
      </fieldset>
    </div>
  );
}
