'use client';

import { Check, CircleHelp, Globe } from 'lucide-react';
import { fitsTruck, type StoreProduct } from '@/lib/store/normalize';
import { truckLabel } from './listing';
import { useStore } from './CartProvider';
import { PILL } from './styles';

type FitProduct = Pick<StoreProduct, 'platforms' | 'generationCollections'>;

/** Fitment against the visitor's saved truck. Renders nothing until a truck is saved. */
export function FitBadge({ product }: { product: FitProduct }) {
  const { truck } = useStore();
  if (!truck) {
    return product.platforms.length === 0 ? <Badge tone="neutral" icon={<Globe className="size-3.5" />}>Universal</Badge> : null;
  }
  const fit = fitsTruck(product, truck);
  if (fit === 'fits') return <Badge tone="good" icon={<Check className="size-3.5" />}>Fits your {truckLabel(truck)}</Badge>;
  if (fit === 'universal') return <Badge tone="neutral" icon={<Globe className="size-3.5" />}>Universal</Badge>;
  if (fit === 'platform') return <Badge tone="warn" icon={<CircleHelp className="size-3.5" />}>Check fitment</Badge>;
  return <Badge tone="muted">Not for your {truckLabel(truck)}</Badge>;
}

const TONES = {
  good: 'bg-clover/15 text-clover',
  warn: 'bg-amber-400/15 text-amber-300',
  neutral: 'bg-chalk/10 text-chalk/80',
  muted: 'bg-chalk/5 text-steel',
} as const;

export function Badge({ tone, icon, children }: { tone: keyof typeof TONES; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold ${PILL} ${TONES[tone]}`}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}
