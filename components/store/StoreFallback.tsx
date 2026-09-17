import { ArrowUpRight } from 'lucide-react';
import { BUSINESS } from '@/lib/site';
import { BTN_PRIMARY, WRAP } from './styles';

/** Shown when Shopify can't be reached. */
export function StoreFallback() {
  return (
    <section className={`${WRAP} pb-24 pt-32 sm:pt-40`} aria-labelledby="store-down">
      <p className="kicker">Parts store</p>
      <h1 id="store-down" className="display mt-4 text-5xl sm:text-7xl">Store is updating.</h1>
      <p className="mt-5 max-w-md text-lg text-chalk/75">Shop the full catalog on luckydiesel.com in the meantime.</p>
      <a href={BUSINESS.store} className={`${BTN_PRIMARY} mt-8`}>
        Shop on luckydiesel.com <ArrowUpRight className="size-5" aria-hidden="true" />
      </a>
    </section>
  );
}
