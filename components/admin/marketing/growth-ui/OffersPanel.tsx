import { createOffer, setOfferActive } from '@/app/admin/marketing/growth/offer-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, EmptyState, fieldClass } from '@/components/app/ui';
import { money } from '@/lib/format';
import { SegmentSelect, ToggleButton } from './forms';
import { Field, areaClass, shortDate } from './kit';
import type { OfferRow } from './offers-events-data';

function OfferCard({ offer }: { offer: OfferRow }) {
  const used = offer.limit ? Math.min(100, Math.round((offer.redemptions / offer.limit) * 100)) : null;
  const state = offer.expired ? <Badge tone="bad">Expired</Badge> : offer.active ? <Badge tone="good">Live</Badge> : <Badge tone="warn">Paused</Badge>;
  return (
    <li className="grid content-between gap-3 rounded-md border border-line bg-carbon-2 p-4">
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm tracking-wider text-clover">{offer.code}</span>
          {state}
        </div>
        <p className="display text-2xl not-italic">{offer.valueLabel}</p>
        <p className="text-sm text-chalk/80">{offer.name}</p>
        <p className="text-xs text-steel">
          Ends {shortDate(offer.endsAt)} · {offer.perCustomer}/customer · {offer.segment ?? 'Everyone'}
        </p>
      </div>
      <div>
        <p className="flex justify-between text-xs text-chalk/70">
          <span>{offer.redemptions}{offer.limit ? ` of ${offer.limit}` : ''} used</span>
          <span>{money(offer.discountCents, { whole: true })} given</span>
        </p>
        {used !== null && <div className="mt-1 h-1.5 rounded-full bg-gunmetal"><div className="h-full rounded-full bg-clover" style={{ width: `${used}%` }} /></div>}
      </div>
      {!offer.expired && <ToggleButton action={setOfferActive} hidden={{ offer_id: offer.id }} next={!offer.active} onLabel="Turn on" offLabel="Pause" />}
    </li>
  );
}

export function OffersPanel({ offers, segments }: { offers: OfferRow[]; segments: { id: string; name: string; count: number }[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section aria-label="Offers" className="min-w-0">
        {offers.length === 0 ? <EmptyState title="No offers yet">Create one on the right.</EmptyState> : (
          <ul className="grid gap-3 sm:grid-cols-2">{offers.map((o) => <OfferCard key={o.id} offer={o} />)}</ul>
        )}
      </section>
      <Card title="New offer">
        <ActionForm action={createOffer} resetOnSuccess className="grid grid-cols-2 gap-3" aria-label="New offer">
          <Field label="Code" htmlFor="of-code" className="col-span-2 sm:col-span-1">
            <input id="of-code" name="code" required maxLength={32} placeholder="WINTER25" className={`${fieldClass} font-mono uppercase`} />
          </Field>
          <Field label="Type" htmlFor="of-kind" className="col-span-2 sm:col-span-1">
            <select id="of-kind" name="kind" defaultValue="amount" className={fieldClass}>
              <option value="amount">$ off</option>
              <option value="percent">% off</option>
              <option value="free_service">Free service</option>
            </select>
          </Field>
          <Field label="Name" htmlFor="of-name" className="col-span-2">
            <input id="of-name" name="name" required maxLength={120} placeholder="$25 off fuel filter service" className={fieldClass} />
          </Field>
          <Field label="Value" htmlFor="of-value" hint="Dollars, or percent for % off.">
            <input id="of-value" name="value" required inputMode="decimal" placeholder="25" className={fieldClass} />
          </Field>
          <Field label="Expires" htmlFor="of-ends">
            <input id="of-ends" name="ends_at" type="datetime-local" className={fieldClass} />
          </Field>
          <Field label="Total limit" htmlFor="of-max">
            <input id="of-max" name="max_redemptions" type="number" min={1} placeholder="No limit" className={fieldClass} />
          </Field>
          <Field label="Per customer" htmlFor="of-per">
            <input id="of-per" name="per_customer_limit" type="number" min={1} defaultValue={1} className={fieldClass} />
          </Field>
          <Field label="Min spend ($)" htmlFor="of-min">
            <input id="of-min" name="min_spend" inputMode="decimal" placeholder="0" className={fieldClass} />
          </Field>
          <Field label="Who can use it" htmlFor="of-seg">
            <SegmentSelect segments={segments} id="of-seg" />
          </Field>
          <Field label="Terms" htmlFor="of-terms" className="col-span-2" hint="Plain rules. We check for risky claims on save.">
            <textarea id="of-terms" name="terms" rows={2} maxLength={500} placeholder="One per truck. Parts extra." className={areaClass} />
          </Field>
          <label className="col-span-2 flex items-center gap-2 text-sm text-chalk/75">
            <input type="checkbox" name="ack" className="size-4 accent-clover" /> Copy checked
          </label>
          <div className="col-span-2"><PendingButton>Create offer</PendingButton></div>
        </ActionForm>
      </Card>
    </div>
  );
}
