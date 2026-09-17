import {
  deletePriceRangeAction, endAbTestAction, saveAbTestAction, saveAnnouncementAction, savePopupAction, savePriceRangeAction, saveSiteOptionsAction, togglePopupAction,
} from '@/app/admin/marketing/pages/engage-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, fieldClass } from '@/components/app/ui';
import { money } from '@/lib/format';
import { abStats, AB_SLOTS, type AbVariant, type Announcement, type PriceRange } from '@/lib/marketing/engage/rules';
import { OTHER_PLATFORM, PLATFORMS, SERVICES } from '@/lib/site';
import { Field, areaClass } from './kit';

export interface SiteData {
  announcement: Announcement | null;
  socialProof: boolean;
  financingUrl: string | null;
  priceRanges: PriceRange[];
  popups: { id: string; name: string; pathPrefix: string; trigger: string; triggerValue: number; active: boolean; views: number; clicks: number }[];
  tests: { id: string; name: string; slot: string; variants: AbVariant[]; active: boolean; events: { variant: string; kind: string }[] }[];
}

const SERVICE_LABEL = new Map(SERVICES.map((s) => [s.id, s.name]));
const PLATFORM_LABEL = new Map<string, string>([['any', 'Any truck'], ...PLATFORMS.map((p) => [p.id, p.name] as [string, string]), [OTHER_PLATFORM, 'Other']]);

/** Bar under the header, plus the toast and financing link. */
export function SiteBarCard({ data }: { data: SiteData }) {
  const bar = data.announcement;
  return (
    <Card title="Announcement bar">
      <ActionForm action={saveAnnouncementAction} className="grid gap-3" aria-label="Announcement bar">
        <Field label="Message" htmlFor="ann-text" hint="Leave empty to take the bar down.">
          <input id="ann-text" name="text" maxLength={140} defaultValue={bar?.text ?? ''} className={fieldClass} placeholder="Tow-season inspection, $89 through April" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Link" htmlFor="ann-href"><input id="ann-href" name="href" maxLength={200} defaultValue={bar?.href ?? ''} className={fieldClass} placeholder="/offers" /></Field>
          <Field label="Link label" htmlFor="ann-label"><input id="ann-label" name="link_label" maxLength={40} defaultValue={bar?.linkLabel ?? ''} className={fieldClass} placeholder="See the offer" /></Field>
          <Field label="Starts" htmlFor="ann-start"><input id="ann-start" name="starts_at" type="date" defaultValue={bar?.startsAt?.slice(0, 10) ?? ''} className={fieldClass} /></Field>
          <Field label="Ends" htmlFor="ann-end"><input id="ann-end" name="ends_at" type="date" defaultValue={bar?.endsAt?.slice(0, 10) ?? ''} className={fieldClass} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-chalk/75">
          <input type="checkbox" name="countdown" defaultChecked={bar?.countdown} className="size-4 accent-clover" /> Show a countdown to the end date
        </label>
        <PendingButton size="sm" className="justify-self-start">Save bar</PendingButton>
      </ActionForm>

      <div className="mt-5 border-t border-line pt-4">
        <ActionForm action={saveSiteOptionsAction} className="grid gap-3" aria-label="Site options">
          <label className="flex items-start gap-2 text-sm text-chalk/75">
            <input type="checkbox" name="social_proof" defaultChecked={data.socialProof} className="mt-0.5 size-4 accent-clover" />
            <span>Show this week’s real job and dyno counts as a one-time toast</span>
          </label>
          <Field label="Financing partner link" htmlFor="fin-url" hint="Shown on builds and the planner. https only.">
            <input id="fin-url" name="financing_url" maxLength={300} defaultValue={data.financingUrl ?? ''} className={fieldClass} placeholder="https://partner.example.com/apply" />
          </Field>
          <PendingButton variant="secondary" size="sm" className="justify-self-start">Save options</PendingButton>
        </ActionForm>
      </div>
    </Card>
  );
}

/** "Starting at" ranges shown in the quote form once a service is picked. */
export function PriceRangeCard({ data }: { data: SiteData }) {
  return (
    <Card title="Starting-at prices">
      <ul className="mb-4 grid gap-2 text-sm">
        {data.priceRanges.map((range) => (
          <li key={`${range.service}-${range.platform}`} className="flex flex-wrap items-center gap-2 border-b border-line pb-2 last:border-b-0">
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{SERVICE_LABEL.get(range.service) ?? range.service}</span>
              <span className="text-steel"> · {PLATFORM_LABEL.get(range.platform) ?? range.platform}</span>
            </span>
            <span className="font-mono tabular-nums">{money(range.lowCents, { whole: true })}–{money(range.highCents, { whole: true })}</span>
            <ActionForm action={deletePriceRangeAction} feedback="none" aria-label="Remove range">
              <input type="hidden" name="service" value={range.service} />
              <input type="hidden" name="platform" value={range.platform} />
              <PendingButton variant="ghost" size="sm">Remove</PendingButton>
            </ActionForm>
          </li>
        ))}
        {data.priceRanges.length === 0 && <li className="text-steel">No ranges yet. The form just asks for details.</li>}
      </ul>
      <ActionForm action={savePriceRangeAction} resetOnSuccess className="grid gap-3" aria-label="Save price range">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Service" htmlFor="pr-service">
            <select id="pr-service" name="service" className={fieldClass} defaultValue={SERVICES[0]?.id}>
              {SERVICES.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
          </Field>
          <Field label="Truck" htmlFor="pr-platform">
            <select id="pr-platform" name="platform" className={fieldClass} defaultValue="any">
              <option value="any">Any truck</option>
              {PLATFORMS.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
            </select>
          </Field>
          <Field label="Low $" htmlFor="pr-low"><input id="pr-low" name="low" inputMode="decimal" required className={fieldClass} placeholder="450" /></Field>
          <Field label="High $" htmlFor="pr-high"><input id="pr-high" name="high" inputMode="decimal" required className={fieldClass} placeholder="900" /></Field>
        </div>
        <p className="text-xs text-steel">Honest ranges only. The form says the price is confirmed after we see the truck.</p>
        <PendingButton size="sm" className="justify-self-start">Save range</PendingButton>
      </ActionForm>
    </Card>
  );
}

/** Page-specific popups, fired by time or scroll. */
export function PopupCard({ data }: { data: SiteData }) {
  return (
    <Card title="Page popups">
      <ul className="mb-4 grid gap-2 text-sm">
        {data.popups.map((popup) => (
          <li key={popup.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-2 last:border-b-0">
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{popup.name}</span>
              <span className="block font-mono text-xs text-steel">{popup.pathPrefix} · {popup.trigger === 'scroll' ? `${popup.triggerValue}% scrolled` : `${popup.triggerValue}s`} · {popup.views} views / {popup.clicks} clicks</span>
            </span>
            <Badge tone={popup.active ? 'good' : 'neutral'}>{popup.active ? 'On' : 'Off'}</Badge>
            <ActionForm action={togglePopupAction} feedback="none" aria-label={popup.active ? 'Turn off' : 'Turn on'}>
              <input type="hidden" name="id" value={popup.id} />
              {!popup.active && <input type="hidden" name="active" value="on" />}
              <PendingButton variant="ghost" size="sm">{popup.active ? 'Turn off' : 'Turn on'}</PendingButton>
            </ActionForm>
          </li>
        ))}
        {data.popups.length === 0 && <li className="text-steel">None yet.</li>}
      </ul>
      <ActionForm action={savePopupAction} resetOnSuccess className="grid gap-3" aria-label="New popup">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="pop-name"><input id="pop-name" name="name" required maxLength={80} className={fieldClass} placeholder="Towing guide on platform pages" /></Field>
          <Field label="Pages starting with" htmlFor="pop-path"><input id="pop-path" name="path_prefix" required maxLength={100} defaultValue="/" className={fieldClass} placeholder="/duramax" /></Field>
          <Field label="Trigger" htmlFor="pop-trigger">
            <select id="pop-trigger" name="trigger" className={fieldClass} defaultValue="time">
              <option value="time">Seconds on page</option>
              <option value="scroll">Percent scrolled</option>
            </select>
          </Field>
          <Field label="Value" htmlFor="pop-value"><input id="pop-value" name="trigger_value" type="number" min={1} max={600} required defaultValue={30} className={fieldClass} /></Field>
        </div>
        <Field label="Headline" htmlFor="pop-headline"><input id="pop-headline" name="headline" required maxLength={90} className={fieldClass} placeholder="Towing checklist for Lowcountry diesels" /></Field>
        <Field label="Body" htmlFor="pop-body"><textarea id="pop-body" name="body" rows={2} maxLength={240} className={areaClass} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Button" htmlFor="pop-cta"><input id="pop-cta" name="cta_label" maxLength={30} defaultValue="See details" className={fieldClass} /></Field>
          <Field label="Button link" htmlFor="pop-href"><input id="pop-href" name="cta_href" required maxLength={200} className={fieldClass} placeholder="/offers" /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-chalk/75"><input type="checkbox" name="active" className="size-4 accent-clover" /> Turn it on now</label>
        <PendingButton size="sm" className="justify-self-start">Save popup</PendingButton>
      </ActionForm>
    </Card>
  );
}

/** Two to four wordings per slot, with results so far. */
export function AbTestCard({ data }: { data: SiteData }) {
  return (
    <Card title="Wording tests">
      <ul className="mb-4 grid gap-3 text-sm">
        {data.tests.map((test) => {
          const stats = abStats(test.variants, test.events);
          return (
            <li key={test.id} className="border-b border-line pb-3 last:border-b-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{test.name}</span>
                <span className="font-mono text-xs text-steel">{test.slot}</span>
                <Badge tone={test.active ? 'good' : 'neutral'}>{test.active ? 'Running' : 'Ended'}</Badge>
                {test.active && (
                  <ActionForm action={endAbTestAction} feedback="none" aria-label="End test">
                    <input type="hidden" name="id" value={test.id} />
                    <PendingButton variant="ghost" size="sm">End</PendingButton>
                  </ActionForm>
                )}
              </p>
              <ul className="mt-1 grid gap-1">
                {stats.map((row) => (
                  <li key={row.key} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-chalk/80">{test.variants.find((v) => v.key === row.key)?.text ?? row.key}</span>
                    <span className="font-mono text-xs tabular-nums text-steel">
                      {row.exposures} views · {row.conversions} leads{row.exposures ? ` · ${Math.round(row.rate * 100)}%` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
        {data.tests.length === 0 && <li className="text-steel">No tests yet.</li>}
      </ul>
      <ActionForm action={saveAbTestAction} resetOnSuccess className="grid gap-3" aria-label="New wording test">
        <Field label="Name" htmlFor="ab-name"><input id="ab-name" name="name" required maxLength={80} className={fieldClass} placeholder="Quote button wording" /></Field>
        <Field label="Where" htmlFor="ab-slot">
          <select id="ab-slot" name="slot" className={fieldClass} defaultValue={AB_SLOTS[0].id}>
            {AB_SLOTS.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
          </select>
        </Field>
        <Field label="Wordings" htmlFor="ab-variants" hint="One per line, two to four.">
          <textarea id="ab-variants" name="variants" rows={4} required className={areaClass} placeholder={'Send service request\nGet my quote'} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-chalk/75"><input type="checkbox" name="active" defaultChecked className="size-4 accent-clover" /> Start it now</label>
        <PendingButton size="sm" className="justify-self-start">Save test</PendingButton>
      </ActionForm>
    </Card>
  );
}
