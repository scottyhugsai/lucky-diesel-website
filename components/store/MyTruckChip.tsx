'use client';

import Link from 'next/link';
import { Check, Truck } from 'lucide-react';
import { useStore } from './CartProvider';
import { productsHref, truckLabel, type StoreParams } from './listing';
import { PILL } from './styles';

const CHIP = `inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border px-4 text-sm font-semibold transition-colors ${PILL}`;

/** One-tap filter to the visitor's saved truck. */
export function MyTruckChip({ params }: { params: StoreParams }) {
  const { truck } = useStore();
  if (!truck) {
    return <Link href="/store#truck-heading" className={`${CHIP} border-dashed border-line text-chalk/80 hover:border-clover`}><Truck className="size-4" aria-hidden="true" /> Set my truck</Link>;
  }
  const isApplied = params.platform === truck.platform && params.gen === truck.generationCollection;
  const href = isApplied
    ? productsHref({ ...params, platform: null, gen: null })
    : productsHref({ ...params, platform: truck.platform, gen: truck.generationCollection });
  return (
    <Link href={href} aria-pressed={isApplied} className={`${CHIP} ${isApplied ? 'border-clover bg-clover/15 text-clover' : 'border-line hover:border-clover'}`}>
      {isApplied ? <Check className="size-4" aria-hidden="true" /> : <Truck className="size-4" aria-hidden="true" />}
      My truck: {truckLabel(truck)}
    </Link>
  );
}
