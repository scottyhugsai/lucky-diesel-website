import { createOffer, createOfferCodes, savePricingPrograms, setOfferActive } from '@/app/admin/marketing/growth/offer-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, EmptyState, fieldClass } from '@/components/app/ui';
import { money } from '@/lib/format';
import type { ProgramSettings } from '@/lib/marketing/core/redemption';
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
        {(offer.singleUse || offer.isPublic || offer.creatorName || offer.giftItem) && (
          <div className="flex flex-wrap gap-1.5">
            {offer.singleUse && <Badge>Single-use</Badge>}
            {offer.isPublic && <Badge>On /offers</Badge>}
            {offer.giftItem && <Badge>Gift</Badge>}
            {offer.creatorName && <Badge>{offer.creatorName} {offer.commissionPercent}%</Badge>}
          </div>
        )}
        {offer.bundleItems.length > 0 && <p className="text-xs text-chalk/70">Bundle: {offer.bundleItems.join(' + ')}</p>}
      </div>
      <div className="grid gap-1.5">
        <p className="flex justify-between text-xs text-chalk/70">
          <span>{offer.redemptions}{offer.limit ? ` of ${offer.limit}` : ''} used</span>
          <span>{money(offer.discountCents, { whole: true })} given</span>
        </p>
        {used !== null && <div className="h-1.5 rounded-full bg-gunmetal"><div className="h-full rounded-full bg-clover" style={{ width: `${used}%` }} /></div>}
        {offer.roi.redemptions > 0 && (
          <p className="text-xs text-steel">
            {money(offer.roi.revenueCents, { whole: true })} revenue · {money(offer.roi.marginCents, { whole: true })} margin
            {offer.roi.roi !== null && <span className={offer.roi.roi >= 1 ? ' text-clover' : ' text-danger'}> · {offer.roi.roi}× ROI</span>}
          </p>
        )}
        {offer.commissionCents > 0 && <p className="text-xs text-steel">Owed {offer.creatorName}: {money(offer.commissionCents, { whole: true })}</p>}
        {offer.singleUse && <p className="text-xs text-steel">{offer.codes.total} codes · {offer.codes.used} used</p>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {!offer.expired && <ToggleButton action={setOfferActive} hidden={{ offer_id: offer.id }} next={!offer.active} onLabel="Turn on" offLabel="Pause" />}
        {offer.singleUse && !offer.expired && (
          <ActionForm action={createOfferCodes} className="flex items-end gap-2" aria-label={`Make codes for ${offer.code}`}>
            <input type="hidden" name="offer_id" value={offer.id} />
            <input name="count" type="number" min={1} max={500} defaultValue={25} aria-label="How many codes" className={`${fieldClass} h-9 w-20`} />
            <PendingButton size="sm" variant="ghost">Make codes</PendingButton>
          </ActionForm>
        )}
      </div>
    </li>
  );
}

function PricingCard({ program }: { program: ProgramSettings }) {
  const tiers = [0, 1, 2].map((i) => program.fleetTiers[i] ?? null);
  return (
    <Card title="Pricing programs">
      <ActionForm action={savePricingPrograms} className="grid gap-3" aria-label="Pricing programs">
        <Field label="Military %" htmlFor="pp-mil" hint="Off labor, verified in person at the counter.">
          <input id="pp-mil" name="military_labor_percent" type="number" min={0} max={50} required defaultValue={program.militaryLaborPercent} className={fieldClass} />
        </Field>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold text-chalk/85">Fleet volume</legend>
          {tiers.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <input name={`fleet_min_${i}`} type="number" min={1} max={1000} placeholder="Trucks" defaultValue={tier?.minTrucks ?? ''} aria-label={`Tier ${i + 1} trucks`} className={`${fieldClass} h-10`} />
              <input name={`fleet_pct_${i}`} type="number" min={0} max={50} placeholder="% labor" defaultValue={tier?.laborPercent ?? ''} aria-label={`Tier ${i + 1} percent`} className={`${fieldClass} h-10`} />
            </div>
          ))}
          <p className="text-xs text-steel">Applied on the invoice from the fleet’s truck count.</p>
        </fieldset>
        <PendingButton>Save pricing</PendingButton>
      </ActionForm>
    </Card>
  );
}

export function OffersPanel({ offers, segments, program }: { offers: OfferRow[]; segments: { id: string; name: string; count: number }[]; program: ProgramSettings }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section aria-label="Offers" className="min-w-0">
        {offers.length === 0 ? <EmptyState title="No offers yet">Create one on the right.</EmptyState> : (
          <ul className="grid gap-3 sm:grid-cols-2">{offers.map((o) => <OfferCard key={o.id} offer={o} />)}</ul>
        )}
      </section>
      <div className="grid content-start gap-6">
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
                <option value="bundle">Bundle price</option>
                <option value="gift">Gift with purchase</option>
              </select>
            </Field>
            <Field label="Name" htmlFor="of-name" className="col-span-2">
              <input id="of-name" name="name" required maxLength={120} placeholder="$25 off fuel filter service" className={fieldClass} />
            </Field>
            <Field label="Value" htmlFor="of-value" hint="Dollars, percent, or the separate price of a bundle.">
              <input id="of-value" name="value" inputMode="decimal" placeholder="25" className={fieldClass} />
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
            <details className="col-span-2 rounded-sm border border-line p-3">
              <summary className="cursor-pointer text-sm font-semibold">Bundle, gift, creator</summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Bundle items" htmlFor="of-items" className="col-span-2" hint="One per line. Two or more.">
                  <textarea id="of-items" name="bundle_items" rows={2} maxLength={600} placeholder={'Fuel filters\nInstall labor'} className={areaClass} />
                </Field>
                <Field label="Bundle price ($)" htmlFor="of-bprice">
                  <input id="of-bprice" name="bundle_price" inputMode="decimal" placeholder="389" className={fieldClass} />
                </Field>
                <Field label="Gift item" htmlFor="of-gift">
                  <input id="of-gift" name="gift_item" maxLength={80} placeholder="Shop tee" className={fieldClass} />
                </Field>
                <Field label="Creator" htmlFor="of-creator">
                  <input id="of-creator" name="creator_name" maxLength={60} placeholder="@dieselcreator" className={fieldClass} />
                </Field>
                <Field label="Commission %" htmlFor="of-comm">
                  <input id="of-comm" name="creator_commission_percent" type="number" min={0} max={50} placeholder="10" className={fieldClass} />
                </Field>
                <Field label="Description" htmlFor="of-desc" className="col-span-2">
                  <input id="of-desc" name="description" maxLength={300} placeholder="What the customer gets" className={fieldClass} />
                </Field>
                <label className="col-span-2 flex items-center gap-2 text-sm text-chalk/75">
                  <input type="checkbox" name="single_use" className="size-4 accent-clover" /> One code per customer
                </label>
                <label className="col-span-2 flex items-center gap-2 text-sm text-chalk/75">
                  <input type="checkbox" name="public" className="size-4 accent-clover" /> List on /offers
                </label>
              </div>
            </details>
            <label className="col-span-2 flex items-center gap-2 text-sm text-chalk/75">
              <input type="checkbox" name="ack" className="size-4 accent-clover" /> Copy checked
            </label>
            <div className="col-span-2"><PendingButton>Create offer</PendingButton></div>
          </ActionForm>
        </Card>
        <PricingCard program={program} />
      </div>
    </div>
  );
}
