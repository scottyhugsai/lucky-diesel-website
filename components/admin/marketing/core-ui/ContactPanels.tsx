import { Download } from 'lucide-react';
import {
  addToCampaignAction, anonymizeContactAction, recordConsentAction, referralCodeAction, saveRevokeAllAction, saveTagsAction, saveTruckAction,
} from '@/app/admin/marketing/contacts/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, buttonClass, Card, fieldClass, labelClass } from '@/components/app/ui';
import type { Tables } from '@/lib/db/database.types';
import { dateTime } from '@/lib/format';
import { TRUCK_USAGES } from '@/lib/marketing/core/segment-rules';
import { KIND_LABEL } from './labels';
import { USAGE_LABEL } from './segment-fields';

export function TagsPanel({ id, tags }: { id: string; tags: string[] }) {
  return (
    <Card title="Tags">
      <ActionForm action={saveTagsAction} className="grid gap-2">
        <input type="hidden" name="id" value={id} />
        <label htmlFor="tags" className="sr-only">Tags, comma separated</label>
        <input id="tags" name="tags" defaultValue={tags.join(', ')} placeholder="tows, boat, military" className={fieldClass} />
        <p className="text-xs text-steel">Separate with commas. Segments can target tags.</p>
        <PendingButton variant="secondary" size="sm" className="justify-self-start">Save tags</PendingButton>
      </ActionForm>
    </Card>
  );
}

export function CampaignPanel({ id, campaigns, enrolledIds }: { id: string; campaigns: { id: string; name: string; kind: string; status: string }[]; enrolledIds: string[] }) {
  const open = campaigns.filter((c) => c.kind !== 'broadcast' && c.status === 'active' && !enrolledIds.includes(c.id));
  return (
    <Card title="Add to campaign">
      {open.length ? (
        <ActionForm action={addToCampaignAction} className="grid gap-2">
          <input type="hidden" name="id" value={id} />
          <label htmlFor="campaign_id" className="sr-only">Campaign</label>
          <select id="campaign_id" name="campaign_id" className={fieldClass} defaultValue="">
            <option value="" disabled>Pick a live drip</option>
            {open.map((c) => <option key={c.id} value={c.id}>{c.name} · {KIND_LABEL[c.kind]}</option>)}
          </select>
          <PendingButton size="sm" className="justify-self-start">Enroll now</PendingButton>
        </ActionForm>
      ) : (
        <p className="text-sm text-steel">No live drips to join.</p>
      )}
      {enrolledIds.length > 0 && <p className="mt-3 text-xs text-steel">In {enrolledIds.length} campaign{enrolledIds.length === 1 ? '' : 's'} already.</p>}
    </Card>
  );
}

export function ReferralPanel({ id, referral, referrals }: { id: string; referral: { code: string; uses: number } | null; referrals: number }) {
  return (
    <Card title="Referral code">
      {referral ? (
        <div className="flex items-end justify-between gap-3">
          <p className="rounded-sm border border-dashed border-clover/50 bg-clover/[0.06] px-3 py-2 font-mono text-lg font-bold tracking-wider text-clover">{referral.code}</p>
          <p className="text-right text-sm text-steel"><span className="display block text-2xl not-italic text-chalk">{referrals}</span>referred</p>
        </div>
      ) : (
        <ActionForm action={referralCodeAction}>
          <input type="hidden" name="id" value={id} />
          <p className="mb-2 text-sm text-steel">No code yet.</p>
          <PendingButton variant="secondary" size="sm">Create code</PendingButton>
        </ActionForm>
      )}
    </Card>
  );
}

export type TruckRow = Pick<Tables<'vehicles'>, 'id' | 'year' | 'make' | 'model' | 'nickname' | 'usage' | 'sold_at'>;

const truckName = (t: TruckRow) => t.nickname || [t.year, t.make, t.model].filter(Boolean).join(' ') || 'Truck';

/** How each truck is used, and whether they still own it. Both drive segments and reminders. */
export function TruckPanel({ id, trucks }: { id: string; trucks: TruckRow[] }) {
  if (!trucks.length) return null;
  return (
    <Card title="Trucks">
      <ul className="grid gap-3">
        {trucks.map((truck) => (
          <li key={truck.id} className="rounded-sm border border-line p-3">
            <ActionForm action={saveTruckAction} className="grid gap-2">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="vehicle_id" value={truck.id} />
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                {truckName(truck)}
                {truck.sold_at && <Badge tone="bad">Sold</Badge>}
              </p>
              <fieldset>
                <legend className={labelClass}>Used for</legend>
                <div className="flex flex-wrap gap-1.5">
                  {TRUCK_USAGES.map((u) => (
                    <label key={u} className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-line px-2 py-1 text-sm hover:border-clover has-[:checked]:border-clover has-[:checked]:text-clover">
                      <input type="checkbox" name="usage" value={u} defaultChecked={truck.usage.includes(u)} className="size-3.5 accent-clover" />
                      {USAGE_LABEL[u]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="sold" defaultChecked={Boolean(truck.sold_at)} className="size-4 accent-clover" />
                Sold or gone
              </label>
              <p className="text-xs text-steel">Sold trucks drop out of reminders and segments.</p>
              <PendingButton variant="secondary" size="sm" className="justify-self-start">Save truck</PendingButton>
            </ActionForm>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Data-access and deletion requests for one person. */
export function PrivacyPanel({ id, erasedAt }: { id: string; erasedAt: string | null }) {
  return (
    <Card title="Data requests">
      {erasedAt ? (
        <p className="text-sm text-steel">Personal data erased {dateTime(erasedAt)}. The consent ledger is kept, hashed.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <a href={`/admin/marketing/contacts/${id}/export?kind=data`} className={buttonClass('secondary', 'sm')} download><Download className="size-4" aria-hidden="true" /> Their data (JSON)</a>
            <a href={`/admin/marketing/contacts/${id}/export?kind=consent`} className={buttonClass('secondary', 'sm')} download><Download className="size-4" aria-hidden="true" /> Consent proof (CSV)</a>
          </div>
          <details className="group mt-3 rounded-sm border border-danger/40">
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-danger/90 hover:text-danger">Erase personal data</summary>
            <ActionForm action={anonymizeContactAction} className="grid gap-2 border-t border-danger/30 p-3" confirm="Erase this person's personal data? Jobs and invoices stay.">
              <input type="hidden" name="id" value={id} />
              <p className="text-xs text-steel">Wipes name, contact info, notes and message text. Invoices and the consent ledger stay.</p>
              <label><span className={labelClass}>Type ERASE</span>
                <input name="confirm" autoComplete="off" placeholder="ERASE" className={fieldClass} />
              </label>
              <PendingButton variant="danger" size="sm" className="justify-self-start">Erase now</PendingButton>
            </ActionForm>
          </details>
        </>
      )}
    </Card>
  );
}

/** Settings toggle: one opt-out revokes every marketing purpose on that address. */
export function RevokeAllForm({ on }: { on: boolean }) {
  return (
    <ActionForm action={saveRevokeAllAction} className="grid gap-2">
      <label className="inline-flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="revoke_all" defaultChecked={on} className="size-4 accent-clover" />
        Revoke all on opt-out
      </label>
      <p className="text-xs text-steel">One opt-out stops marketing on every purpose for that address. Job updates still send.</p>
      <PendingButton variant="secondary" size="sm" className="justify-self-start">Save</PendingButton>
    </ActionForm>
  );
}

export function ConsentLedger({ id, events }: { id: string; events: Tables<'contact_consent_events'>[] }) {
  return (
    <Card title="Consent ledger">
      {events.length ? (
        <ol className="mb-4 grid gap-2">
          {events.slice(0, 12).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line pb-2 text-sm last:border-b-0">
              <Badge tone={e.action === 'granted' ? 'good' : 'bad'}>{e.channel === 'sms' ? 'SMS' : 'Email'} {e.action}</Badge>
              <span className="text-chalk/70">{e.purpose} · {e.method}</span>
              {e.consent_text_version && <span className="font-mono text-[0.7rem] text-steel">v{e.consent_text_version}</span>}
              <time className="ml-auto text-xs text-steel" dateTime={e.created_at}>{dateTime(e.created_at)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mb-4 text-sm text-steel">No consent recorded.</p>
      )}
      <details className="group rounded-sm border border-line">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-chalk/80 hover:text-clover">Record consent by hand</summary>
        <ActionForm action={recordConsentAction} className="grid gap-2 border-t border-line p-3" resetOnSuccess>
          <input type="hidden" name="id" value={id} />
          <div className="grid grid-cols-2 gap-2">
            <label><span className={labelClass}>Channel</span>
              <select name="channel" className={fieldClass}><option value="sms">Text</option><option value="email">Email</option></select>
            </label>
            <label><span className={labelClass}>Choice</span>
              <select name="action" className={fieldClass}><option value="revoked">Opted out</option><option value="granted">Opted in</option></select>
            </label>
          </div>
          <label><span className={labelClass}>How they told you</span>
            <input name="note" maxLength={300} placeholder="Said no more texts at pickup" className={fieldClass} />
          </label>
          <PendingButton variant="secondary" size="sm" className="justify-self-start">Save to ledger</PendingButton>
        </ActionForm>
      </details>
    </Card>
  );
}
