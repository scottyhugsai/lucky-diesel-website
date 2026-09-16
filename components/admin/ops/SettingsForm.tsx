'use client';

import { useActionState } from 'react';
import { saveSettings } from '@/app/admin/settings/actions';
import { SubmitButton } from '@/components/app/SubmitButton';
import { fieldClass, labelClass } from '@/components/app/ui';
import type { Tables } from '@/lib/db/database.types';
import type { ActionState } from './form';
import { FormMessage } from './FormMessage';
import { hourLabel } from './time';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOT_OPTIONS = [30, 45, 60, 90, 120, 180, 240];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-line pt-6 first:border-t-0 first:pt-0 md:grid-cols-[14rem_1fr]">
      <div>
        <legend className="display text-xl not-italic">{title}</legend>
        {hint && <p className="mt-1 text-sm text-chalk/55">{hint}</p>}
      </div>
      <div className="grid gap-4">{children}</div>
    </fieldset>
  );
}

export function SettingsForm({ settings }: { settings: Tables<'shop_settings'> }) {
  const [state, action] = useActionState<ActionState, FormData>(saveSettings, {});
  const hours = Array.from({ length: 25 }, (_, h) => h);

  return (
    <form action={action} className="grid gap-6 rounded-md border border-line bg-carbon-2 p-4 sm:p-6">
      <Section title="Pricing" hint="Used on estimates and invoices.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="labor_rate" className={labelClass}>Labor rate ($/hr)</label>
            <input id="labor_rate" name="labor_rate" type="number" min={0} max={1000} step="0.01" required defaultValue={(settings.labor_rate_cents / 100).toFixed(2)} className={`${fieldClass} tabular-nums`} />
          </div>
          <div>
            <label htmlFor="tax_rate" className={labelClass}>Sales tax (%)</label>
            <input id="tax_rate" name="tax_rate" type="number" min={0} max={20} step="0.01" required defaultValue={(Number(settings.tax_rate) * 100).toFixed(2)} className={`${fieldClass} tabular-nums`} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="parts_taxable" defaultChecked={settings.parts_taxable} className="size-4 accent-[var(--clover)]" />Parts are taxable</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="labor_taxable" defaultChecked={settings.labor_taxable} className="size-4 accent-[var(--clover)]" />Labor is taxable</label>
        </div>
      </Section>

      <Section title="Owner alerts" hint="Where new-lead alerts and the daily summary go.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="owner_email" className={labelClass}>Owner email</label>
            <input id="owner_email" name="owner_email" type="email" defaultValue={settings.owner_email ?? ''} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="owner_phone" className={labelClass}>Owner mobile</label>
            <input id="owner_phone" name="owner_phone" type="tel" defaultValue={settings.owner_phone ?? ''} className={fieldClass} />
          </div>
        </div>
      </Section>

      <Section title="Google reviews" hint="Sent to every customer the day after pickup.">
        <div>
          <label htmlFor="google_review_url" className={labelClass}>Review link</label>
          <input id="google_review_url" name="google_review_url" type="url" inputMode="url" placeholder="https://search.google.com/local/writereview?placeid=…" defaultValue={settings.google_review_url ?? ''} className={fieldClass} aria-describedby="review-help" />
          <p id="review-help" className="mt-2 text-xs leading-relaxed text-steel">
            Find the shop’s Place ID with Google’s Place ID Finder (search “Place ID Finder”), then paste
            <code className="mx-1 break-all rounded-sm bg-carbon px-1 py-0.5 text-chalk/80">https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID</code>.
            Or copy the “Ask for reviews” link from your Google Business Profile.
          </p>
        </div>
      </Section>

      <Section title="Scheduling" hint="Controls open slots for online booking and the calendar.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="bay_count" className={labelClass}>Bays</label>
            <input id="bay_count" name="bay_count" type="number" min={1} max={20} step={1} required defaultValue={settings.bay_count} className={`${fieldClass} tabular-nums`} />
          </div>
          <div>
            <label htmlFor="open_hour" className={labelClass}>Opens</label>
            <select id="open_hour" name="open_hour" defaultValue={settings.open_hour} className={fieldClass}>
              {hours.slice(0, 24).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="close_hour" className={labelClass}>Closes</label>
            <select id="close_hour" name="close_hour" defaultValue={settings.close_hour} className={fieldClass}>
              {hours.slice(1).map((h) => <option key={h} value={h}>{h === 24 ? 'Midnight' : hourLabel(h)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="slot_minutes" className={labelClass}>Slot length</label>
            <select id="slot_minutes" name="slot_minutes" defaultValue={settings.slot_minutes} className={fieldClass}>
              {SLOT_OPTIONS.map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} hr${m === 60 ? '' : 's'}`}</option>)}
            </select>
          </div>
        </div>
        <fieldset>
          <legend className={labelClass}>Open days</legend>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day, index) => (
              <label key={day} className="cursor-pointer">
                <input type="checkbox" name="open_days" value={index} defaultChecked={settings.open_days.includes(index)} className="peer sr-only" />
                <span className="inline-flex h-10 w-14 items-center justify-center rounded-sm border border-line text-sm font-semibold text-steel transition-colors peer-checked:border-clover peer-checked:bg-clover/15 peer-checked:text-clover peer-focus-visible:ring-2 peer-focus-visible:ring-clover">{day}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
