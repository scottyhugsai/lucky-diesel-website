import { Plus } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import type { ActionState } from '@/components/admin/core/parse';
import { fieldClass, labelClass } from '@/components/app/ui';
import { money } from '@/lib/format';

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
