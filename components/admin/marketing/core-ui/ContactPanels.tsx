import { addToCampaignAction, recordConsentAction, referralCodeAction, saveTagsAction } from '@/app/admin/marketing/contacts/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, fieldClass, labelClass } from '@/components/app/ui';
import type { Tables } from '@/lib/db/database.types';
import { dateTime } from '@/lib/format';
import { KIND_LABEL } from './labels';

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
