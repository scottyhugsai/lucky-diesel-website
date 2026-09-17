'use client';

import { FlaskConical, Moon } from 'lucide-react';
import { fieldClass, labelClass } from '@/components/app/ui';
import { EXIT_OPTIONS } from './campaign-input';
import { hourLabel } from './labels';

export interface ScheduleState {
  sendAt: string;
  windowStart: number;
  windowEnd: number;
  abPercent: number;
  abMetric: 'click' | 'booking';
  abDecideHours: number;
  exitOn: string[];
}

const EXIT_LABEL: Record<string, string> = { booked: 'They book', replied: 'They reply', unsubscribed: 'They unsubscribe' };


interface ScheduleFieldsProps {
  kind: 'broadcast' | 'drip' | 'lifecycle';
  hasB: boolean;
  quiet: { start: number; end: number };
  value: ScheduleState;
  onChange: (next: ScheduleState) => void;
}

export function ScheduleFields({ kind, hasB, quiet, value, onChange }: ScheduleFieldsProps) {
  const set = (patch: Partial<ScheduleState>) => onChange({ ...value, ...patch });
  const effectiveStart = Math.max(value.windowStart, quiet.end);
  const effectiveEnd = Math.min(value.windowEnd, quiet.start);
  const hours = Array.from({ length: 24 }, (_, h) => h);

  return (
    <div className="grid gap-5">
      {kind === 'broadcast' ? (
        <label className="max-w-xs"><span className={labelClass}>Send at (shop time)</span>
          <input type="datetime-local" name="scheduled_at" value={value.sendAt} onChange={(e) => set({ sendAt: e.target.value })} className={fieldClass} />
        </label>
      ) : (
        <p className="text-sm text-chalk/70">Starts right away. People enroll when the trigger fires.</p>
      )}

      <fieldset>
        <legend className={labelClass}>Send window</legend>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select aria-label="Window start" value={value.windowStart} onChange={(e) => set({ windowStart: Number(e.target.value) })} className={`${fieldClass.replace("w-full", "")} w-28`}>
            {hours.slice(0, 23).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
          to
          <select aria-label="Window end" value={value.windowEnd} onChange={(e) => set({ windowEnd: Number(e.target.value) })} className={`${fieldClass.replace("w-full", "")} w-28`}>
            {hours.slice(1).concat(24).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </div>
        <svg viewBox="0 0 240 14" preserveAspectRatio="none" width="100%" height="14" className="mt-3 block max-w-md" role="img" aria-label={`Sends between ${hourLabel(effectiveStart)} and ${hourLabel(effectiveEnd)}`}>
          <rect width="240" height="14" rx="3" fill="var(--gunmetal)" />
          {effectiveEnd > effectiveStart && <rect x={effectiveStart * 10} width={(effectiveEnd - effectiveStart) * 10} height="14" rx="3" fill="var(--clover)" />}
          {[6, 12, 18].map((h) => <line key={h} x1={h * 10} x2={h * 10} y1="0" y2="14" stroke="var(--carbon)" strokeWidth="1" />)}
        </svg>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-steel">
          <Moon className="size-3.5" aria-hidden="true" /> Quiet hours {hourLabel(quiet.start)}–{hourLabel(quiet.end)} always win. Late sends wait for morning.
        </p>
        {value.windowEnd <= value.windowStart && <p role="alert" className="mt-1 text-sm text-danger">Window must end after it starts.</p>}
      </fieldset>

      {hasB && (
        <fieldset className="rounded-md border border-violet/40 bg-violet/[0.06] p-4">
          <legend className="flex items-center gap-1.5 px-1 text-sm font-bold text-violet-300"><FlaskConical className="size-4" aria-hidden="true" /> A/B test</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {kind === 'broadcast' && (
              <label><span className={labelClass}>Test group</span>
                <select value={value.abPercent} onChange={(e) => set({ abPercent: Number(e.target.value) })} className={fieldClass}>
                  {[10, 20, 30, 50, 100].map((p) => <option key={p} value={p}>{p === 100 ? 'Everyone (50/50)' : `${p}% then winner`}</option>)}
                </select>
              </label>
            )}
            <label><span className={labelClass}>Winner by</span>
              <select value={value.abMetric} onChange={(e) => set({ abMetric: e.target.value === 'booking' ? 'booking' : 'click' })} className={fieldClass}>
                <option value="click">Most clicks</option>
                <option value="booking">Most bookings</option>
              </select>
            </label>
            {kind === 'broadcast' && value.abPercent < 100 && (
              <label><span className={labelClass}>Pick winner after</span>
                <select value={value.abDecideHours} onChange={(e) => set({ abDecideHours: Number(e.target.value) })} className={fieldClass}>
                  {[2, 4, 8, 24].map((h) => <option key={h} value={h}>{h} hours</option>)}
                </select>
              </label>
            )}
          </div>
        </fieldset>
      )}

      {kind !== 'broadcast' && (
        <fieldset>
          <legend className={labelClass}>Stop the drip when</legend>
          <div className="flex flex-wrap gap-2">
            {EXIT_OPTIONS.map((option) => {
              const on = value.exitOn.includes(option);
              return (
                <label key={option} className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-sm border px-3 text-sm font-semibold ${on ? 'border-clover text-chalk' : 'border-line text-chalk/60'}`}>
                  <input type="checkbox" checked={on} onChange={() => set({ exitOn: on ? value.exitOn.filter((e) => e !== option) : [...value.exitOn, option] })} className="size-4" />
                  {EXIT_LABEL[option]}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}
