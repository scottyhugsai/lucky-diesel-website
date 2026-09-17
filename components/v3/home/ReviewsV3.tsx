import Link from 'next/link';
import { Star } from 'lucide-react';
import { BTN_GHOST, SECTION, WRAP } from '../ui';

/** Honest placeholder until a Google Business Profile exists. Never shows fabricated reviews. */
export function ReviewsV3() {
  return (
    <section aria-labelledby="reviews-heading" className={`${SECTION} border-t border-line bg-carbon-2`}>
      <div className={`${WRAP} flex flex-col items-start gap-5 rounded-[8px] sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center border border-line text-steel"><Star className="size-5" /></span>
          <div>
            <p className="v3-mono text-xs text-clover">05 / REVIEWS</p>
            <h2 id="reviews-heading" className="v3-title mt-1.5 text-2xl">Reviews coming soon</h2>
            <p className="mt-1.5 max-w-md text-[0.9375rem] text-chalk/65">Be the first. Tell us how your truck runs and it goes straight to the owner.</p>
          </div>
        </div>
        <Link href="/review" className={`${BTN_GHOST} shrink-0`}>Leave a review</Link>
      </div>
    </section>
  );
}
