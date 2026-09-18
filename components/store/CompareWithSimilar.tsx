import { ArrowRight } from 'lucide-react';
import type { SavedTruck } from '@/lib/fitment/truck-cookie';
import type { StoreProduct } from '@/lib/store/normalize';
import { MAX_COMPARE } from '@/lib/store/specs';
import { FitBadge } from './FitBadge';
import { priceLabel } from './listing';
import { BTN_GHOST, PILL, TILE } from './styles';

/**
 * Knowing what fits is the easy half. This is the other half, offered where the
 * choice is actually being made — a plain GET form, so it works with JavaScript
 * off and lands on a shareable URL.
 */
export function CompareWithSimilar({ product, similar, truck }: {
  product: StoreProduct;
  similar: readonly StoreProduct[];
  truck: SavedTruck | null;
}) {
  const options = similar.slice(0, MAX_COMPARE - 1);
  if (options.length === 0) return null;

  return (
    <section aria-labelledby="compare-heading" className={`border border-line bg-carbon-2 p-4 sm:p-5 ${TILE} [[data-design=v2]_&]:border-transparent`}>
      <h2 id="compare-heading" className="font-semibold">Compare with similar</h2>
      <p className="mt-1 text-sm text-steel">Every row says what the spec means.</p>

      <form method="get" action="/store/compare" className="mt-3">
        <input type="hidden" name="c" value={product.handle} />
        <ul className="grid gap-1.5">
          {options.map((option, index) => (
            <li key={option.handle}>
              <label className={`flex min-h-11 cursor-pointer items-center gap-3 border border-line px-3 py-2 text-sm transition-colors hover:border-clover ${PILL}`}>
                <input type="checkbox" name="c" value={option.handle} defaultChecked={index === 0} className="size-4 shrink-0 accent-clover" />
                <span className="min-w-0 flex-1">
                  <span data-copy="data" className="line-clamp-2 font-semibold">{option.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-steel">
                    <span className="tabular-nums">{priceLabel(option)}</span>
                    <FitBadge product={option} truck={truck} />
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button type="submit" className={`${BTN_GHOST} mt-3 w-full`}>
          Compare side by side <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
