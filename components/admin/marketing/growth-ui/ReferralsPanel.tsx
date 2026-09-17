import { createReferralCode, setReferralCodeActive } from '@/app/admin/marketing/growth/referral-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, EmptyState, TableWrap, tableClass } from '@/components/app/ui';
import { money } from '@/lib/format';
import { CopyButton } from './CopyButton';
import { CustomerSelect, ToggleButton } from './forms';
import type { CustomerOption, ReferralOverview } from './growth-data';
import { Field, Metric, shortDate } from './kit';

const STAGES = ['pending', 'qualified', 'rewarded'] as const;
const STAGE_LABEL: Record<string, string> = { pending: 'Referred', qualified: 'First job done', rewarded: 'Rewarded', void: 'Void' };

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
                <li key={l.id} className="flex items-center gap-3">
                  <span className="grid size-7 place-items-center rounded-sm bg-gunmetal font-mono text-sm">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{l.customer}</span>
                  <span className="font-mono tabular-nums text-clover">{l.referred}</span>
                </li>
              ))}
            </ol>
          )}
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
    </div>
  );
}
