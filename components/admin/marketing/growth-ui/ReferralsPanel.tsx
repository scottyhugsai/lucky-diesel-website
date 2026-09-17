import { createPartner, createReferralCode, setLeaderboardOptIn, setPartnerActive, setReferralCodeActive } from '@/app/admin/marketing/growth/referral-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, EmptyState, TableWrap, fieldClass, tableClass } from '@/components/app/ui';
import { money } from '@/lib/format';
import { CopyButton } from './CopyButton';
import { CustomerSelect, ToggleButton } from './forms';
import type { CustomerOption, PartnerRow, ReferralOverview } from './growth-data';
import { Field, Metric, shortDate } from './kit';

const STAGES = ['pending', 'qualified', 'rewarded'] as const;
const STAGE_LABEL: Record<string, string> = { pending: 'Referred', qualified: 'First job done', rewarded: 'Rewarded', void: 'Void' };
const PARTNER_KIND: Record<string, string> = { boat_dealer: 'Boat dealer', rv_dealer: 'RV dealer', trailer_dealer: 'Trailer dealer', other: 'Partner' };

/** Month label for a statement row: "2026-09" → "Sep 2026". */
function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  return `${new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(year), Number(m) - 1, 1)))} ${year}`;
}

function PartnerCard({ partner }: { partner: PartnerRow }) {
  return (
    <li className="grid gap-2 rounded-md border border-line bg-carbon p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{partner.name} {!partner.active && <Badge tone="warn">Paused</Badge>}</p>
          <p className="text-xs text-steel">{PARTNER_KIND[partner.kind] ?? 'Partner'} · <span className="font-mono">{partner.code}</span> · {money(partner.rewardCents, { whole: true })}/job</p>
        </div>
        <CopyButton value={partner.link} />
      </div>
      <p className="text-xs text-chalk/70">{partner.referred} referred · {partner.rewarded} earned · {money(partner.owedCents, { whole: true })} owed</p>
      {partner.statement.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-chalk/80">Statement</summary>
          <ul className="mt-2 grid gap-1">
            {partner.statement.map((row) => (
              <li key={row.month} className="flex justify-between gap-3 tabular-nums">
                <span>{monthLabel(row.month)}</span>
                <span className="text-steel">{row.referred} referred · {row.rewarded} paid</span>
                <span className="font-mono text-clover">{money(row.owedCents, { whole: true })}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <ToggleButton action={setPartnerActive} hidden={{ partner_id: partner.id }} next={!partner.active} onLabel="Turn on" offLabel="Pause" />
    </li>
  );
}

export function ReferralsPanel({ data, customers }: { data: ReferralOverview; customers: CustomerOption[] }) {
  const leaders = [...data.codes].filter((c) => c.referred > 0).sort((a, b) => b.referred - a.referred).slice(0, 5);
  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid grid-cols-2 gap-4 rounded-md border border-line bg-carbon-2 p-4 sm:grid-cols-4 sm:p-5">
        <Metric label="Referred" value={data.totals.pending} />
        <Metric label="Job done" value={data.totals.qualified} />
        <Metric label="Rewards paid" value={money(data.totals.rewardedCents, { whole: true })} tone="good" />
        <Metric label="Rewards pending" value={money(data.totals.pendingCents, { whole: true })} tone="warn" />
      </div>
      <p className="text-sm text-chalk/65">
        Referrer gets {money(data.settings.referrerRewardCents, { whole: true })} credit after the friend’s first paid job. Friend gets {money(data.settings.refereeDiscountCents, { whole: true })} off.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card title="Pipeline" padded={false}>
          {data.pipeline.length === 0 ? <div className="p-4"><EmptyState title="No referrals yet">Share a code to start.</EmptyState></div> : (
            <ol className="grid gap-px bg-line sm:grid-cols-3">
              {STAGES.map((stage) => {
                const rows = data.pipeline.filter((r) => r.status === stage);
                return (
                  <li key={stage} className="bg-carbon-2 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-steel">{STAGE_LABEL[stage]} · {rows.length}</p>
                    <ul className="mt-3 grid gap-2">
                      {rows.slice(0, 6).map((r) => (
                        <li key={r.id} className="rounded-sm border border-line p-2.5 text-sm">
                          <p className="font-semibold">{r.referred}</p>
                          <p className="text-xs text-steel">from {r.referrer} · {shortDate(r.createdAt)}</p>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
        <Card title="Leaderboard">
          {leaders.length === 0 ? <p className="text-sm text-chalk/60">No referrers yet.</p> : (
            <ol className="grid gap-2">
              {leaders.map((l, i) => (
                <li key={l.id} className="flex items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-gunmetal font-mono text-sm">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{l.customer}</span>
                  <span className="font-mono tabular-nums text-clover">{l.referred}</span>
                  <ToggleButton action={setLeaderboardOptIn} hidden={{ customer_id: l.customerId }} next={!l.optIn} onLabel="Show" offLabel="Hide" />
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-steel">The public board shows first name only, and only if they said yes.</p>
        </Card>
      </div>

      <Card title="Codes & links">
        <ActionForm action={createReferralCode} className="mb-5 flex flex-wrap items-end gap-3" aria-label="New referral code">
          <Field label="Give a customer a code" htmlFor="ref-customer" className="min-w-0 flex-1 sm:max-w-sm">
            <CustomerSelect customers={customers} id="ref-customer" />
          </Field>
          <PendingButton>Make code</PendingButton>
        </ActionForm>
        <TableWrap>
          <table className={tableClass}>
            <thead><tr><th>Customer</th><th>Code</th><th>Referred</th><th>Paid out</th><th>Share</th><th /></tr></thead>
            <tbody>
              {data.codes.map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.customer}</td>
                  <td><span className="whitespace-nowrap font-mono">{c.code}</span> {!c.active && <Badge tone="warn">Paused</Badge>}</td>
                  <td className="tabular-nums">{c.referred}</td>
                  <td className="tabular-nums">{money(c.rewardedCents, { whole: true })}</td>
                  <td><CopyButton value={c.link} /></td>
                  <td><ToggleButton action={setReferralCodeActive} hidden={{ code_id: c.id }} next={!c.active} onLabel="Turn on" offLabel="Pause" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card title="Partners">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-label="Partner list" className="min-w-0">
            {data.partners.length === 0 ? <EmptyState title="No partners yet">Add a dealer on the right.</EmptyState> : (
              <ul className="grid gap-3 sm:grid-cols-2">{data.partners.map((p) => <PartnerCard key={p.id} partner={p} />)}</ul>
            )}
          </section>
          <ActionForm action={createPartner} resetOnSuccess className="grid gap-3" aria-label="New partner">
            <Field label="Name" htmlFor="pt-name"><input id="pt-name" name="name" required maxLength={80} placeholder="Blue Water Boats" className={fieldClass} /></Field>
            <Field label="Type" htmlFor="pt-kind">
              <select id="pt-kind" name="kind" defaultValue="boat_dealer" className={fieldClass}>
                <option value="boat_dealer">Boat dealer</option>
                <option value="rv_dealer">RV dealer</option>
                <option value="trailer_dealer">Trailer dealer</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Reward ($)" htmlFor="pt-reward" hint="Paid per referred truck’s first job.">
              <input id="pt-reward" name="reward" inputMode="decimal" placeholder="25" className={fieldClass} />
            </Field>
            <Field label="Contact" htmlFor="pt-contact"><input id="pt-contact" name="contact_name" maxLength={80} placeholder="Name" className={fieldClass} /></Field>
            <Field label="Phone" htmlFor="pt-phone"><input id="pt-phone" name="phone" type="tel" maxLength={20} placeholder="(555) 555-5555" className={fieldClass} /></Field>
            <Field label="Email" htmlFor="pt-email"><input id="pt-email" name="email" type="email" maxLength={120} placeholder="shop@dealer.com" className={fieldClass} /></Field>
            <Field label="Code" htmlFor="pt-code" hint="Blank makes one from the name."><input id="pt-code" name="code" maxLength={32} placeholder="BLUEWATER-REF" className={`${fieldClass} font-mono uppercase`} /></Field>
            <PendingButton>Add partner</PendingButton>
          </ActionForm>
        </div>
      </Card>
    </div>
  );
}
