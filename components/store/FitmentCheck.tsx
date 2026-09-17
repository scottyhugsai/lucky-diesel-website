'use client';

import { Check, CircleHelp, Globe, X } from 'lucide-react';
import { fitsTruck, type StoreProduct } from '@/lib/store/normalize';
import { useStore } from './CartProvider';
import { truckLabel } from './listing';
import { TruckSelect } from './TruckSelect';
import { TILE } from './styles';

/** "Will it fit?" panel on the product page, bound to the saved truck. */
export function FitmentCheck({ product }: { product: Pick<StoreProduct, 'platforms' | 'generationCollections'> }) {
  const { truck } = useStore();
  const fit = truck ? fitsTruck(product, truck) : product.platforms.length ? null : 'universal';
  const label = truckLabel(truck);

  const result = {
    fits: { icon: Check, tone: 'text-clover', text: `Fits your ${label}.` },
    platform: { icon: CircleHelp, tone: 'text-amber-300', text: 'Check fitment — pick your generation or call us.' },
    universal: { icon: Globe, tone: 'text-chalk', text: 'Universal — not truck-specific.' },
    no: { icon: X, tone: 'text-danger', text: `Not listed for your ${label}.` },
  } as const;
  const shown = fit ? result[fit] : null;

  return (
    <section aria-labelledby="fit-heading" className={`border border-line bg-carbon-2 p-4 sm:p-5 ${TILE} [[data-design=v2]_&]:border-transparent`}>
      <h2 id="fit-heading" className="font-semibold">Will it fit?</h2>
      <div className="mt-3"><TruckSelect idPrefix="fit" /></div>
      <p className={`mt-3 flex items-center gap-2 text-sm font-semibold ${shown?.tone ?? 'text-steel'}`} aria-live="polite">
        {shown ? <><shown.icon className="size-4 shrink-0" aria-hidden="true" />{shown.text}</> : 'Pick your truck to check.'}
      </p>
    </section>
  );
}
