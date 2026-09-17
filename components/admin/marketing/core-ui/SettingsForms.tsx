import { saveBrandVoiceAction, saveSeasonalAction, saveSendingRulesAction } from '@/app/admin/marketing/settings/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { fieldClass, labelClass } from '@/components/app/ui';
import type { Tables } from '@/lib/db/database.types';
import type { MarketingSettings } from '@/lib/marketing/core/settings';
import { hourLabel } from './labels';
import { SEASONAL_TEMPLATES } from './seasonal';

const hint = 'mt-1 text-xs text-steel';

function HourSelect({ name, value, hours, label }: { name: string; value: number; hours: number[]; label: string }) {
  return (
    <label><span className={labelClass}>{label}</span>
      <select name={name} defaultValue={value} className={fieldClass}>
        {hours.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
      </select>
    </label>
  );
}

export function SendingRulesForm({ settings }: { settings: MarketingSettings }) {
  return (
    <ActionForm action={saveSendingRulesAction} className="grid gap-6">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="kicker mb-3">Frequency caps</legend>
        <label><span className={labelClass}>Marketing texts per week</span>
          <input name="sms_max_per_week" type="number" min={0} max={14} defaultValue={settings.smsMaxPerWeek} className={fieldClass} />
        </label>
        <label><span className={labelClass}>Marketing emails per week</span>
          <input name="email_max_per_week" type="number" min={0} max={14} defaultValue={settings.emailMaxPerWeek} className={fieldClass} />
        </label>
        <p className={`${hint} sm:col-span-2`}>Service texts don’t count. Extra sends are skipped and logged.</p>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="kicker mb-3">Quiet hours</legend>
        <HourSelect name="quiet_hours_start" label="No marketing from" value={settings.quietHoursStart} hours={[18, 19, 20, 21]} />
        <HourSelect name="quiet_hours_end" label="Until" value={settings.quietHoursEnd} hours={[8, 9, 10]} />
        <label><span className={labelClass}>Time zone</span>
          <select name="time_zone" defaultValue={settings.timeZone} className={fieldClass}>
            {['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'].map((tz) => <option key={tz} value={tz}>{tz.replace('America/', '').replace('_', ' ')}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="kicker mb-3">Sender identity</legend>
        <label><span className={labelClass}>Email from name</span>
          <input name="sender_name" required maxLength={80} defaultValue={settings.senderName} className={fieldClass} />
        </label>
        <label><span className={labelClass}>Text prefix name</span>
          <input name="sms_business_name" required maxLength={40} defaultValue={settings.smsBusinessName} className={fieldClass} />
        </label>
        <label><span className={labelClass}>From email</span>
          <input name="sender_email" type="email" defaultValue={settings.senderEmail ?? ''} placeholder="news@luckydiesel.com" className={fieldClass} />
        </label>
        <label><span className={labelClass}>Reply-to email</span>
          <input name="reply_to_email" type="email" defaultValue={settings.replyToEmail ?? ''} className={fieldClass} />
        </label>
        <label className="sm:col-span-2"><span className={labelClass}>Postal address (email footer)</span>
          <input name="postal_address" required maxLength={200} defaultValue={settings.postalAddress ?? ''} className={fieldClass} />
        </label>
      </fieldset>
      <PendingButton className="justify-self-start">Save sending rules</PendingButton>
    </ActionForm>
  );
}

export function SeasonalToggles({ settings }: { settings: MarketingSettings }) {
  return (
    <ActionForm action={saveSeasonalAction} className="grid gap-3">
      <ul className="grid gap-2 sm:grid-cols-3">
        {SEASONAL_TEMPLATES.filter((t) => t.toggle).map((t) => (
          <li key={t.key}>
            <label className="flex h-full cursor-pointer items-start gap-3 rounded-md border border-line bg-carbon p-3 has-[:checked]:border-clover/60">
              <input type="checkbox" name={`season_${t.toggle}`} defaultChecked={settings.seasonal[t.toggle!] !== false} className="mt-1 size-4" />
              <span><span className="block font-bold">{t.name}</span><span className="text-xs text-steel">{t.window}</span></span>
            </label>
          </li>
        ))}
      </ul>
      <PendingButton variant="secondary" size="sm" className="justify-self-start">Save seasonal plays</PendingButton>
    </ActionForm>
  );
}

function ListField({ name, label, values, help }: { name: string; label: string; values: string[]; help: string }) {
  return (
    <label><span className={labelClass}>{label}</span>
      <textarea name={name} rows={4} defaultValue={values.join('\n')} className={`${fieldClass} h-auto py-2 text-sm leading-relaxed`} />
      <span className={`block ${hint}`}>{help}</span>
    </label>
  );
}

export function BrandVoiceForm({ voice }: { voice: Tables<'brand_voice'> | null }) {
  return (
    <ActionForm action={saveBrandVoiceAction} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <label><span className={labelClass}>Tone</span>
          <input name="tone" required maxLength={300} defaultValue={voice?.tone ?? ''} className={fieldClass} />
        </label>
        <label><span className={labelClass}>Default call to action</span>
          <input name="default_cta" required maxLength={40} defaultValue={voice?.default_cta ?? 'Book a bay'} className={fieldClass} />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ListField name="do_rules" label="Always" values={voice?.do_rules ?? []} help="One rule per line." />
        <ListField name="dont_rules" label="Never" values={voice?.dont_rules ?? []} help="One rule per line." />
        <ListField name="banned_phrases" label="Banned phrases" values={voice?.banned_phrases ?? []} help="Drafts using these get flagged." />
        <ListField name="approved_claims" label="Approved claims" values={voice?.approved_claims ?? []} help="Claims you can back up." />
        <ListField name="hashtags" label="Hashtags" values={voice?.hashtags ?? []} help="One per line, with #." />
      </div>
      <PendingButton className="justify-self-start">Save brand voice</PendingButton>
    </ActionForm>
  );
}
