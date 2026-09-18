import { Check, CircleHelp, Globe, X } from 'lucide-react';
import type { SavedTruck } from '@/lib/fitment/truck-cookie';
import { fitsTruck, type StoreProduct } from '@/lib/store/normalize';
import { savedTruckLabel } from './listing';
import { PILL } from './styles';

type FitProduct = Pick<StoreProduct, 'platforms' | 'generationCollections'>;

/**
 * Fitment against the visitor's saved truck, rendered on the server from the
 * truck cookie so the answer is on the card before anything hydrates — and
 * still there with JavaScript switched off.
 */
export function FitBadge({ product, truck }: { product: FitProduct; truck: SavedTruck | null }) {
  const label = savedTruckLabel(truck);
  if (!truck || !label) {
    return product.platforms.length === 0 ? <Badge tone="neutral" icon={<Globe className="size-3.5" />}>Universal</Badge> : null;
  }
  const fit = fitsTruck(product, truck.selection);
  if (fit === 'fits') return <Badge tone="good" icon={<Check className="size-3.5" />}>Fits your {label}</Badge>;
  if (fit === 'universal') return <Badge tone="neutral" icon={<Globe className="size-3.5" />}>Universal</Badge>;
  if (fit === 'platform') return <Badge tone="warn" icon={<CircleHelp className="size-3.5" />}>Check fitment</Badge>;
  return <Badge tone="muted" icon={<X className="size-3.5" />}>Doesn’t fit your {label}</Badge>;
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
