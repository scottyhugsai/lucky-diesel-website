import { Plus } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import type { ActionState } from '@/components/admin/core/parse';
import { fieldClass, labelClass } from '@/components/app/ui';
import { money } from '@/lib/format';
import { CAMPAIGN_TEMPLATES, DEFAULT_CALL_HOURS, TOWNS } from '@/lib/marketing/content/ad-presets';

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export interface GuardView {
  platform: string;
  maxDailyCents: number;
  maxMonthlyCents: number;
  maxCampaignDays: number;
  autoPauseCplCents: number | null;
}

function shopDate(offsetDays: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

/** New campaign: platform, audience, budget under the hard cap, and dates. */
export function CampaignForm({ action, guards }: { action: Action; guards: readonly GuardView[] }) {
  const capOf = (p: string) => guards.find((g) => g.platform === p);
  const shopCap = capOf('all');
  return (
    <ActionForm action={action} resetOnSuccess className="grid gap-4 sm:grid-cols-2" aria-label="New campaign">
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="c-name">Name</label>
        <input id="c-name" name="name" className={fieldClass} placeholder="Fall tow-ready push" maxLength={80} required />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="c-template">Template</label>
        <select id="c-template" name="template" className={fieldClass} defaultValue="">
          <option value="">No template</option>
          {CAMPAIGN_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label} — {t.hint}</option>)}
        </select>
        <p className="mt-1 text-xs text-chalk/55">A template sets the goal, radius, towns and call hours.</p>
      </div>
      <div>
        <label className={labelClass} htmlFor="c-platform">Platform</label>
        <select id="c-platform" name="platform" className={fieldClass} defaultValue="meta">
          <option value="meta">Meta{capOf('meta') ? ` · ${money(capOf('meta')!.maxDailyCents, { whole: true })}/day` : ''}</option>
          <option value="google">Google{capOf('google') ? ` · ${money(capOf('google')!.maxDailyCents, { whole: true })}/day` : ''}</option>
          <option value="tiktok">TikTok{capOf('tiktok') ? ` · ${money(capOf('tiktok')!.maxDailyCents, { whole: true })}/day` : ''}</option>
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="c-objective">Goal</label>
        <select id="c-objective" name="objective" className={fieldClass} defaultValue="leads">
          <option value="leads">Leads</option>
          <option value="calls">Calls</option>
          <option value="traffic">Site visits</option>
          <option value="sales">Parts sales</option>
          <option value="awareness">Awareness</option>
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="c-radius">Radius (miles)</label>
        <input id="c-radius" name="radius" type="number" min={5} max={100} defaultValue={30} className={fieldClass} required />
      </div>
      <div>
        <label className={labelClass} htmlFor="c-audience">Audience note</label>
        <input id="c-audience" name="audience" className={fieldClass} placeholder="Diesel truck owners" maxLength={200} />
      </div>
      <div>
        <label className={labelClass} htmlFor="c-daily">Daily budget ($)</label>
        <input id="c-daily" name="daily" inputMode="decimal" className={fieldClass} defaultValue="20" required />
        <p className="mt-1 text-xs text-chalk/55">Hard cap{shopCap ? `: ${money(shopCap.maxDailyCents, { whole: true })}/day shop-wide` : ' per platform'}. Over-cap budgets are refused.</p>
      </div>
      <details className="sm:col-span-2 rounded-sm border border-line bg-carbon p-3">
        <summary className="cursor-pointer text-sm font-semibold">Targeting</summary>
        <div className="mt-3 grid gap-3">
          <fieldset>
            <legend className={labelClass}>Extra towns</legend>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {TOWNS.map((t) => (
                <label key={t.key} className="flex items-center gap-2 text-xs text-chalk/75">
                  <input type="checkbox" name="towns" value={t.key} className="size-4 accent-clover" />{t.name}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-chalk/55">Each adds a 10-mile circle on top of the radius.</p>
          </fieldset>
          <div>
            <label className={labelClass} htmlFor="c-exclude">Exclude towns</label>
            <select id="c-exclude" name="excludeTowns" multiple size={4} className={fieldClass}>
              {TOWNS.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="negativeKeywords" defaultChecked className="size-4 accent-clover" />Block waste searches
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="callHours" className="size-4 accent-clover" />Run in shop hours only
            <span className="text-xs text-chalk/55">Mon–Fri {DEFAULT_CALL_HOURS.startHour}–{DEFAULT_CALL_HOURS.endHour}</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="aiEnhancements" className="size-4 accent-clover" />Let the platform edit creative
          </label>
          <p className="text-xs text-chalk/55">Financing wording switches the campaign to Meta’s financial category automatically.</p>
        </div>
      </details>
      <div className="grid grid-cols-2 gap-3 sm:col-span-2">
        <div>
          <label className={labelClass} htmlFor="c-starts">Start</label>
          <input id="c-starts" name="starts" type="date" className={fieldClass} defaultValue={shopDate(1)} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="c-ends">End</label>
          <input id="c-ends" name="ends" type="date" className={fieldClass} defaultValue={shopDate(14)} required />
        </div>
      </div>
      <div className="sm:col-span-2">
        <PendingButton><Plus className="size-4" aria-hidden="true" />Create campaign</PendingButton>
      </div>
    </ActionForm>
  );
}

/** Edits one budget cap row. */
export function GuardForm({ action, guard, label }: { action: Action; guard: GuardView | null; label: string; }) {
  const dollars = (cents: number | null | undefined) => (cents == null ? '' : String(cents / 100));
  const platform = guard?.platform ?? label.toLowerCase();
  return (
    <ActionForm action={action} className="grid grid-cols-2 gap-2 rounded-sm border border-line bg-carbon p-3 sm:grid-cols-4 sm:items-end" aria-label={`${label} budget cap`}>
      <input type="hidden" name="platform" value={platform} />
      <p className="col-span-2 font-semibold sm:col-span-4">{label}</p>
      <label className="text-xs text-steel">$/day<input name="maxDaily" inputMode="decimal" defaultValue={dollars(guard?.maxDailyCents)} className={`${fieldClass} mt-1 h-9`} required /></label>
      <label className="text-xs text-steel">$/month<input name="maxMonthly" inputMode="decimal" defaultValue={dollars(guard?.maxMonthlyCents)} className={`${fieldClass} mt-1 h-9`} required /></label>
      <label className="text-xs text-steel">Max days<input name="maxDays" type="number" min={1} max={365} defaultValue={guard?.maxCampaignDays ?? 30} className={`${fieldClass} mt-1 h-9`} required /></label>
      <label className="text-xs text-steel">Pause at $/lead<input name="cpl" inputMode="decimal" defaultValue={dollars(guard?.autoPauseCplCents)} className={`${fieldClass} mt-1 h-9`} /></label>
      <div className="col-span-2 sm:col-span-4"><PendingButton size="sm" variant="secondary">Save cap</PendingButton></div>
    </ActionForm>
  );
}
