import { applyDiscount, removeDiscount } from '@/app/admin/invoices/discount-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Card, fieldClass } from '@/components/app/ui';
import { dateOnly, money } from '@/lib/format';
import type { InvoiceDiscountState } from '@/lib/marketing/core/redemption';

function Hidden({ invoiceId, kind }: { invoiceId: string; kind?: string }) {
  return (
    <>
      <input type="hidden" name="invoice_id" value={invoiceId} />
      {kind && <input type="hidden" name="kind" value={kind} />}
    </>
  );
}

function QuickApply({ invoiceId, kind, label, amountCents }: { invoiceId: string; kind: string; label: string; amountCents: number }) {
  return (
    <ActionForm action={applyDiscount} aria-label={label}>
      <Hidden invoiceId={invoiceId} kind={kind} />
      <PendingButton size="sm" variant="secondary">{label} −{money(amountCents)}</PendingButton>
    </ActionForm>
  );
}

/** Invoice screen: codes, points, referral credit and pricing programs. */
export function DiscountsCard({ invoiceId, state }: { invoiceId: string; state: InvoiceDiscountState }) {
  const has = (kind: string) => state.applied.some((a) => a.kind === kind);
  const quick = [
    state.referral.eligible && !has('referral') && state.referral.amountCents > 0 && { kind: 'referral', label: 'Referred friend', amountCents: state.referral.amountCents },
    state.tier.percent > 0 && !has('tier') && state.tier.amountCents > 0 && { kind: 'tier', label: `Tier ${state.tier.percent}%`, amountCents: state.tier.amountCents },
    state.fleet.percent > 0 && !has('fleet') && state.fleet.amountCents > 0 && { kind: 'fleet', label: `Fleet ${state.fleet.percent}%`, amountCents: state.fleet.amountCents },
  ].filter((q): q is { kind: string; label: string; amountCents: number } => Boolean(q));

  return (
    <Card title="Discounts">
      {state.applied.length > 0 && (
        <ul className="mb-4 grid gap-2 text-sm">
          {state.applied.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0">{d.label}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-bold tabular-nums text-clover">−{money(d.amountCents)}</span>
                {state.editable && (
                  <ActionForm action={removeDiscount} aria-label={`Remove ${d.label}`} confirm={`Remove ${d.label}?`}>
                    <Hidden invoiceId={invoiceId} />
                    <input type="hidden" name="discount_id" value={d.id} />
                    <PendingButton size="sm" variant="ghost" aria-label={`Remove ${d.label}`}>Remove</PendingButton>
                  </ActionForm>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!state.editable ? (
        <p className="text-sm text-steel">{state.lockedReason} Discounts are locked.</p>
      ) : (
        <div className="grid gap-4">
          {!has('offer') && (
            <ActionForm action={applyDiscount} className="flex flex-wrap items-end gap-2" aria-label="Apply code" resetOnSuccess>
              <Hidden invoiceId={invoiceId} kind="offer" />
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-xs font-semibold text-chalk/70">Offer code</span>
                <input name="code" required maxLength={32} placeholder="FALLFUEL10" autoComplete="off" className={`${fieldClass} h-10 font-mono uppercase`} />
              </label>
              <PendingButton size="sm" className="!h-10">Apply</PendingButton>
            </ActionForm>
          )}

          {quick.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quick.map((q) => <QuickApply key={q.kind} invoiceId={invoiceId} {...q} />)}
            </div>
          )}

          {!has('points') && state.points.maxPoints > 0 && (
            <ActionForm action={applyDiscount} className="flex flex-wrap items-end gap-2" aria-label="Use points">
              <Hidden invoiceId={invoiceId} kind="points" />
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-xs font-semibold text-chalk/70">Points ({state.points.balance.toLocaleString('en-US')} · {money(state.program.pointValueCents * 100)}/100)</span>
                <input name="points" type="number" min={1} max={state.points.maxPoints} defaultValue={state.points.maxPoints} className={`${fieldClass} h-10`} />
              </label>
              <PendingButton size="sm" variant="secondary" className="!h-10">Use points</PendingButton>
            </ActionForm>
          )}

          {!has('military') && state.military.percent > 0 && state.military.amountCents > 0 && (
            <details className="rounded-sm border border-line p-3 text-sm">
              <summary className="cursor-pointer font-semibold">Military / first responder</summary>
              <ActionForm action={applyDiscount} className="mt-3 grid gap-2" aria-label="Military pricing">
                <Hidden invoiceId={invoiceId} kind="military" />
                {state.military.verifiedAt ? (
                  <p className="text-steel">Verified {dateOnly(state.military.verifiedAt)}{state.military.note ? ` · ${state.military.note}` : ''}</p>
                ) : (
                  <>
                    <label className="flex items-center gap-2"><input type="checkbox" name="verified" required className="size-4 accent-clover" /> ID seen in person</label>
                    <input name="note" required maxLength={120} placeholder="What you saw, e.g. VA card" aria-label="Verification note" className={`${fieldClass} h-10`} />
                    <p className="text-xs text-steel">Don’t copy or upload IDs.</p>
                  </>
                )}
                <PendingButton size="sm" variant="secondary">{state.military.percent}% labor −{money(state.military.amountCents)}</PendingButton>
              </ActionForm>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
