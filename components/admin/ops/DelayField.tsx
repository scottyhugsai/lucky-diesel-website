'use client';

import { fieldClass, labelClass } from '@/components/app/ui';

export type DelayUnit = 'minutes' | 'hours' | 'days';

export function splitDelay(minutes: number): { amount: number; unit: DelayUnit } {
  if (minutes > 0 && minutes % 1440 === 0) return { amount: minutes / 1440, unit: 'days' };
  if (minutes > 0 && minutes % 60 === 0) return { amount: minutes / 60, unit: 'hours' };
  return { amount: minutes, unit: 'minutes' };
}

export const UNIT_MINUTES: Record<DelayUnit, number> = { minutes: 1, hours: 60, days: 1440 };

interface DelayFieldProps {
  amount: number;
  unit: DelayUnit;
  beforeAppointment: boolean;
  onChange: (next: { amount: number; unit: DelayUnit }) => void;
}

export function DelayField({ amount, unit, beforeAppointment, onChange }: DelayFieldProps) {
  return (
    <fieldset>
      <legend className={labelClass}>Timing</legend>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="delay_amount" className="sr-only">Delay amount</label>
        <div className="w-24">
        <input
          id="delay_amount"
          name="delay_amount"
          type="number"
          inputMode="numeric"
          min={0}
          max={beforeAppointment ? 30 * 24 : 90 * 24 * 60}
          step={1}
          value={Number.isNaN(amount) ? '' : amount}
          onChange={(e) => onChange({ amount: e.target.valueAsNumber, unit })}
          className={`${fieldClass} tabular-nums`}
        />
        </div>
        <label htmlFor="delay_unit" className="sr-only">Delay unit</label>
        <div className="w-32">
        <select id="delay_unit" name="delay_unit" value={unit} onChange={(e) => onChange({ amount, unit: e.target.value as DelayUnit })} className={fieldClass}>
          <option value="minutes">minutes</option>
          <option value="hours">hours</option>
          <option value="days">days</option>
        </select>
        </div>
        <span className="text-sm text-chalk/70">{beforeAppointment ? 'before the appointment' : 'after the trigger'}</span>
      </div>
      <p className="mt-1.5 text-xs text-steel">
        {beforeAppointment ? 'Skipped automatically if the appointment is booked closer than this.' : '0 sends instantly. Delayed customer texts wait out 9pm–8am quiet hours.'}
      </p>
    </fieldset>
  );
}
