'use client';

import { Check, CircleHelp, Globe, X } from 'lucide-react';
import type { SavedTruck } from '@/lib/fitment/truck-cookie';
import { fitsTruck, type StoreProduct } from '@/lib/store/normalize';
import { useStore } from './CartProvider';
import { savedTruckLabel } from './listing';
import { TruckSelect } from './TruckSelect';
import { TILE } from './styles';

const RESULTS = {
  fits: { icon: Check, tone: 'text-clover', text: (label: string) => `Fits your ${label}.` },
  platform: { icon: CircleHelp, tone: 'text-steel', text: () => 'Check fitment — pick your generation or call us.' },
  universal: { icon: Globe, tone: 'text-chalk', text: () => 'Universal — not truck-specific.' },
  no: { icon: X, tone: 'text-danger', text: (label: string) => `Doesn’t fit your ${label}.` },
} as const;

/**
 * "Will it fit?" on the product page. The verdict is rendered from the truck
 * cookie on the server, so it is right before hydration and right without
 * JavaScript; the selects then keep it live for anyone who changes truck here.
 */
export function FitmentCheck({ product, initialTruck }: {
  product: Pick<StoreProduct, 'platforms' | 'generationCollections'>;
  initialTruck: SavedTruck | null;
}) {
  const { savedTruck, truckReady } = useStore();
  const truck = truckReady ? savedTruck : initialTruck;
  const label = savedTruckLabel(truck);

  const fit = truck && label ? fitsTruck(product, truck.selection) : product.platforms.length ? null : 'universal';
  const shown = fit ? RESULTS[fit] : null;

  return (
    <section aria-labelledby="fit-heading" className={`border border-line bg-carbon-2 p-4 sm:p-5 ${TILE} [[data-design=v2]_&]:border-transparent`}>
      <h2 id="fit-heading" className="font-semibold">Will it fit?</h2>
      <div className="mt-3"><TruckSelect idPrefix="fit" initialTruck={initialTruck} /></div>
      <p className={`mt-3 flex items-center gap-2 text-sm font-semibold ${shown?.tone ?? 'text-steel'}`} aria-live="polite">
        {shown ? <><shown.icon className="size-4 shrink-0" aria-hidden="true" />{shown.text(label ?? '')}</> : 'Pick your truck to check.'}
      </p>
    </section>
  );
}
