import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { BUSINESS } from '@/lib/site';
import type { StoreProduct } from '@/lib/store/normalize';
import { BTN_PRIMARY, PILL } from './styles';

/**
 * Stands in for the buy box on a sample listing. There is deliberately no path
 * from here into the cart: a made-up part must never reach a real checkout.
 */
export function SampleQuoteBox({ product }: { product: StoreProduct }) {
  const platform = product.platforms[0];
  const quoteHref = `/?${platform ? `truck=${platform}&` : ''}about=${encodeURIComponent(`I'm asking about: ${product.title}`)}#quote`;

  return (
    <div>
      <p className="text-3xl font-bold">Quote</p>
      <p className="mt-2 max-w-sm text-sm text-steel">
        A sample catalogue listing. Tell us your truck and we will price and source it.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href={quoteHref} className={`${BTN_PRIMARY} flex-1`}>Get a price</Link>
        <a href={BUSINESS.smsHref} className={`flex min-h-12 flex-1 items-center justify-center gap-2 border border-line px-5 font-semibold transition-colors hover:border-clover hover:text-clover ${PILL}`}>
          <MessageSquare className="size-5" aria-hidden="true" /> Text us
        </a>
      </div>
    </div>
  );
}
