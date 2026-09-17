import { adjustPoints, saveLoyaltyProgram } from '@/app/admin/marketing/growth/referral-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Card, TableWrap, fieldClass, tableClass } from '@/components/app/ui';
import { money } from '@/lib/format';
import type { PerkTier } from '@/lib/marketing/core/promotions';
import { CustomerSelect } from './forms';
import { TIER_LABEL, type CustomerOption, type LoyaltyOverview } from './growth-data';
import { Field, shortDate } from './kit';

const PERK_TIERS: readonly PerkTier[] = ['stage_1', 'stage_2', 'full_build'];

export function LoyaltyPanel({ data, customers }: { data: LoyaltyOverview; customers: CustomerOption[] }) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.tiers.map((t, i) => (
          <li key={t.tier} className="rounded-md border border-line bg-carbon-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-steel">Tier {i + 1}</p>
            <p className="display mt-1 text-2xl not-italic">{TIER_LABEL[t.tier]}</p>
            <p className="mt-2 font-mono text-3xl tabular-nums text-clover">{t.count}</p>
            <p className="text-xs text-steel">{t.minCents ? `${money(t.minCents, { whole: true })}+ spent` : 'Everyone'}</p>
            {t.tier !== 'stock' && <p className="mt-1 text-xs text-chalk/70">{data.perks[t.tier as PerkTier].perk}</p>}
          </li>
        ))}
      </ol>
      <p className="text-sm text-chalk/65">
        {data.settings.loyaltyPointsPerDollar} point per $1 paid, worth {money(data.pointValueCents * 100)} per 100. Tiers update nightly; upgrades get a message.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Members" padded={false}>
          <TableWrap>
            <table className={tableClass}>
              <thead><tr><th>Customer</th><th>Tier</th><th className="text-right">Points</th><th className="text-right">Spent</th></tr></thead>
              <tbody>
                {data.members.slice(0, 50).map((m) => (
                  <tr key={m.customerId}>
                    <td className="font-semibold">{m.name}</td>
                    <td>{TIER_LABEL[m.tier] ?? m.tier}</td>
                    <td className="text-right font-mono tabular-nums">{m.points.toLocaleString('en-US')}</td>
                    <td className="text-right font-mono tabular-nums">{money(m.spendCents, { whole: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
        <div className="grid grid-cols-1 content-start gap-6">
          <Card title="Adjust points">
            <ActionForm action={adjustPoints} resetOnSuccess className="grid gap-3" aria-label="Adjust points">
              <Field label="Customer" htmlFor="pts-customer"><CustomerSelect customers={customers} id="pts-customer" /></Field>
              <Field label="Points" htmlFor="pts-points" hint="Use a minus sign to remove.">
                <input id="pts-points" name="points" type="number" step={1} required className={fieldClass} placeholder="250" />
              </Field>
              <Field label="Reason" htmlFor="pts-note"><input id="pts-note" name="note" required maxLength={200} className={fieldClass} placeholder="Dyno day bonus" /></Field>
              <PendingButton>Save points</PendingButton>
            </ActionForm>
          </Card>
          <Card title="Tier perks">
            <ActionForm action={saveLoyaltyProgram} className="grid gap-3" aria-label="Tier perks">
              <Field label="Cents per point" htmlFor="point-value" hint="What one point is worth at checkout.">
                <input id="point-value" name="point_value_cents" type="number" step={1} min={1} max={100} required defaultValue={data.pointValueCents} className={fieldClass} />
              </Field>
              {PERK_TIERS.map((tier) => (
                <fieldset key={tier} className="grid gap-2 rounded-sm border border-line p-3">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-widest text-steel">{TIER_LABEL[tier]}</legend>
                  <Field label="Perk" htmlFor={`perk-${tier}`}>
                    <input id={`perk-${tier}`} name={`perk_${tier}`} required maxLength={80} defaultValue={data.perks[tier].perk} className={fieldClass} />
                  </Field>
                  <Field label="Labor %" htmlFor={`pct-${tier}`}>
                    <input id={`pct-${tier}`} name={`pct_${tier}`} type="number" step={1} min={0} max={20} required defaultValue={data.perks[tier].laborPercent} className={fieldClass} />
                  </Field>
                </fieldset>
              ))}
              <PendingButton variant="secondary">Save program</PendingButton>
            </ActionForm>
          </Card>
          <Card title="Recent">
            <ul className="grid gap-2 text-sm">
              {data.recent.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">{e.name}<span className="text-steel"> · {e.note ?? e.kind}</span></span>
                  <span className={`font-mono tabular-nums ${e.points < 0 ? 'text-danger' : 'text-clover'}`}>{e.points > 0 ? '+' : ''}{e.points}</span>
                </li>
              ))}
              {data.recent.length === 0 && <li className="text-chalk/60">No point changes yet.</li>}
            </ul>
            {data.recent[0] && <p className="mt-2 text-xs text-steel">Last change {shortDate(data.recent[0].at, true)}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
