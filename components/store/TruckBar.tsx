import Link from 'next/link';
import { Truck, X } from 'lucide-react';
import { fitmentParams } from '@/lib/fitment/select';
import type { SavedTruck } from '@/lib/fitment/truck-cookie';
import { productsHref, savedTruckLabel, type StoreParams, type TruckFilter } from './listing';
import { PILL, TILE } from './styles';
import { TruckSync } from './TruckSync';

export const TRUCK_ENDPOINT = '/fitment/truck';

const LINK = 'inline-flex min-h-11 items-center font-semibold text-clover underline-offset-4 hover:underline';

/**
 * The truck the visitor picked, stated on every store surface with one obvious
 * way to drop it. Server-rendered from the cookie, so it is here on the first
 * paint and here without JavaScript.
 */
export function TruckBar({ truck, returnTo, params, filter }: {
  truck: SavedTruck | null;
  /** Where clearing returns the visitor to: the page they are on. */
  returnTo: string;
  params?: StoreParams;
  filter?: TruckFilter;
}) {
  const label = savedTruckLabel(truck);
  if (!truck || !label) {
    return (
      <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 border border-dashed border-line px-4 py-2 text-sm text-steel ${TILE}`}>
        <TruckSync truck={null} />
        <Truck className="size-4 shrink-0" aria-hidden="true" />
        Shopping for a truck?
        <Link href="/fitment" className={LINK}>Tell us which one</Link>
      </p>
    );
  }

  const change = truck.fitment.year ? `/fitment?${fitmentParams(truck.fitment).toString()}` : '/store#truck-heading';

  return (
    <section aria-label="Your truck" className={`flex flex-wrap items-center gap-x-4 gap-y-2 border border-clover/40 bg-clover/10 px-4 py-2 text-sm ${TILE}`}>
      <TruckSync truck={truck} />
      <p className="flex items-center gap-2 text-chalk/80">
        <Truck className="size-4 shrink-0 text-clover" aria-hidden="true" />
        Your truck: <strong className="font-semibold text-chalk">{label}</strong>
      </p>

      {filter?.fromSavedTruck && params && (
        <Link href={productsHref({ ...params, all: true })} className={LINK}>Show all parts</Link>
      )}
      {params?.all && !params.platform && (
        <Link href={productsHref({ ...params, all: false })} className={LINK}>Only what fits</Link>
      )}
      <Link href={change} className={LINK}>Change</Link>

      <form method="post" action={TRUCK_ENDPOINT} className="sm:ml-auto">
        <input type="hidden" name="clear" value="1" />
        <input type="hidden" name="to" value={returnTo} />
        <button
          type="submit"
          className={`inline-flex min-h-11 items-center gap-1.5 border border-line px-3 font-semibold text-steel transition-colors hover:border-clover hover:text-clover ${PILL}`}
        >
          <X className="size-4" aria-hidden="true" /> Clear
          <span className="sr-only">saved truck {label}</span>
        </button>
      </form>
    </section>
  );
}
