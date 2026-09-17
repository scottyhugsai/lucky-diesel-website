import { decideUgcAction, revokeReleaseAction, saveReleaseAction } from '../release-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { SectionTabs } from '@/components/admin/marketing/studio/Bits';
import { SOCIAL_TABS } from '@/components/admin/marketing/studio/labels';
import { Badge, Card, EmptyState, PageHeader, fieldClass, labelClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Releases | Marketing' };

const SCOPES = [
  { name: 'allow_truck', label: 'Their truck', default: true },
  { name: 'allow_plate', label: 'Plate visible', default: false },
  { name: 'allow_face', label: 'Their face', default: false },
  { name: 'allow_name', label: 'Their name', default: false },
  { name: 'allow_testimonial', label: 'Quote them', default: false },
] as const;

const METHODS = [
  { value: 'signed_form', label: 'Signed form' },
  { value: 'web_form', label: 'Web form' },
  { value: 'email', label: 'Email' },
  { value: 'text', label: 'Text' },
  { value: 'verbal', label: 'Said in person' },
] as const;

const SIGNED_SECONDS = 600;

export default async function ReleasesPage() {
  await requireRole('admin');
  const db = createAdminClient();
  const [{ data: releases }, { data: submissions }, { data: customers }] = await Promise.all([
    db.from('media_releases').select('*').order('signed_at', { ascending: false }).limit(60),
    db.from('ugc_submissions').select('*').order('created_at', { ascending: false }).limit(30),
    db.from('customers').select('id, full_name').order('full_name').limit(300),
  ]);

  const pending = (submissions ?? []).filter((s) => s.status === 'pending');
  const previews = new Map<string, string>();
  for (const row of pending) {
    const { data } = await db.storage.from('ugc').createSignedUrl(row.storage_path, SIGNED_SECONDS);
    if (data?.signedUrl) previews.set(row.id, data.signedUrl);
  }

  return (
    <>
      <SectionTabs tabs={SOCIAL_TABS} active="/admin/marketing/social/releases" />
      <PageHeader
        kicker="Social"
        title="Photo releases"
        description="What each customer agreed we may publish, and the photos they sent in."
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          <Card title={`Customer photos${pending.length ? ` · ${pending.length} waiting` : ''}`}>
            {pending.length === 0 ? (
              <EmptyState title="Nothing waiting">Photos sent from the gallery page land here for review.</EmptyState>
            ) : (
              <ul className="grid gap-4">
                {pending.map((row) => (
                  <li key={row.id} className="grid gap-3 border-b border-line pb-4 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)]">
                    {previews.get(row.id) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private signed URL, no loader
                      <img src={previews.get(row.id)} alt={`${row.name}'s truck`} className="h-32 w-full rounded-sm object-cover" />
                    ) : (
                      <div className="grid h-32 place-items-center rounded-sm border border-line text-xs text-steel">No preview</div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold">{row.name}{row.handle ? <span className="text-steel"> · {row.handle}</span> : null}</p>
                      <p className="text-sm text-chalk/70">{row.truck ?? 'Truck not given'}</p>
                      {row.caption && <p className="mt-1 text-sm text-chalk/60">“{row.caption}”</p>}
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-steel">
                        <Badge tone={row.credit_ok ? 'good' : 'neutral'}>{row.credit_ok ? 'Credit OK' : 'No credit'}</Badge>
                        <Badge tone="good">Rights confirmed</Badge>
                        {dateTime(row.created_at)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <ActionForm action={decideUgcAction} feedback="below" aria-label="Approve photo">
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="decision" value="approve" />
                          <PendingButton size="sm">Approve &amp; draft post</PendingButton>
                        </ActionForm>
                        <ActionForm action={decideUgcAction} feedback="none" confirm="Reject this photo?" aria-label="Reject photo">
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="decision" value="reject" />
                          <PendingButton variant="ghost" size="sm">Reject</PendingButton>
                        </ActionForm>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Release ledger" padded={false}>
            {(releases ?? []).length === 0 ? (
              <EmptyState title="No releases yet">Record one before posting a customer’s truck, face or words.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {(releases ?? []).map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{row.person_name}</span>
                      <span className="block text-xs text-steel">
                        {[row.allow_truck && 'truck', row.allow_plate && 'plate', row.allow_face && 'face', row.allow_name && 'name', row.allow_testimonial && 'quote'].filter(Boolean).join(', ') || 'nothing'}
                        {' · '}{row.method.replace('_', ' ')} · {dateTime(row.signed_at)}
                      </span>
                    </span>
                    {row.incentivized && <Badge tone="warn">Incentivized</Badge>}
                    {row.source === 'ugc' && <Badge tone="info">Sent in</Badge>}
                    {row.revoked_at ? (
                      <Badge tone="bad">Revoked</Badge>
                    ) : (
                      <ActionForm action={revokeReleaseAction} feedback="none" confirm="Revoke this release?" aria-label="Revoke release">
                        <input type="hidden" name="id" value={row.id} />
                        <PendingButton variant="ghost" size="sm">Revoke</PendingButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Record a release">
          <ActionForm action={saveReleaseAction} resetOnSuccess className="grid gap-3" aria-label="Record a release">
            <label htmlFor="person_name"><span className={labelClass}>Their name</span>
              <input id="person_name" name="person_name" required maxLength={120} className={fieldClass} placeholder="Cody Brooks" />
            </label>
            <label htmlFor="customer_id"><span className={labelClass}>Customer (optional)</span>
              <select id="customer_id" name="customer_id" className={fieldClass} defaultValue="">
                <option value="">Not linked</option>
                {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </label>
            <fieldset className="grid gap-1.5">
              <legend className={labelClass}>They said yes to</legend>
              {SCOPES.map((scope) => (
                <label key={scope.name} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={scope.name} defaultChecked={scope.default} className="size-4 accent-[var(--clover)]" />
                  {scope.label}
                </label>
              ))}
            </fieldset>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="incentivized" className="mt-0.5 size-4 accent-[var(--clover)]" />
              <span>They got something for it (posts need <span className="font-mono">#ad</span>)</span>
            </label>
            <label htmlFor="method"><span className={labelClass}>How they told us</span>
              <select id="method" name="method" className={fieldClass} defaultValue="signed_form">
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
            <label htmlFor="evidence"><span className={labelClass}>Where it’s filed</span>
              <input id="evidence" name="evidence" maxLength={500} className={fieldClass} placeholder="Signed form in the job folder" />
            </label>
            <PendingButton size="sm" className="justify-self-start">Save release</PendingButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
