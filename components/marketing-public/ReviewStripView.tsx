import { Star } from 'lucide-react';
import type { ReviewWidget } from '@/lib/marketing/content/reputation';

const SOURCE: Record<string, string> = { google: 'Google', facebook: 'Facebook', manual: 'Customer' };

/**
 * Presentational review strip. Server-safe, no JS. Renders nothing without real reviews.
 * Styles adapt to all three designs through the data-design variants.
 */
export function ReviewStripView({ widget, heading = "What owners say", stack = false }: { widget: ReviewWidget; heading?: string; stack?: boolean }) {
  if (widget.reviews.length === 0) return null;
  return (
    <section aria-labelledby="review-strip-heading" className="border-t border-line py-14 sm:py-20">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="kicker">Reviews</p>
            <h2 id="review-strip-heading" className="display mt-2 text-3xl sm:text-4xl">{heading}</h2>
          </div>
          {widget.average !== null && (
            <p className="flex items-center gap-2 text-chalk/80">
              <Star className="size-5 fill-amber-300 text-amber-300" aria-hidden="true" />
              <span className="font-mono text-2xl tabular-nums text-chalk">{widget.average.toFixed(1)}</span>
              <span className="text-sm">from {widget.count} review{widget.count === 1 ? '' : 's'}</span>
            </p>
          )}
        </header>
        <ul className={stack ? "grid gap-3" : "-mx-4 flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3"}>
          {widget.reviews.map((review) => (
            <li
              key={review.id}
              className={`grid ${stack ? "" : "w-[82%] shrink-0 snap-start sm:w-auto"} content-between gap-4 rounded-md border border-line bg-carbon-2 p-5 [[data-design=v2]_&]:rounded-2xl [[data-design=v3]_&]:rounded-lg`}
            >
              <blockquote className="line-clamp-6 text-chalk/85">“{review.body}”</blockquote>
              <footer className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold">{review.author}</span>
                <span className="flex items-center gap-1.5 text-steel">
                  <span className="sr-only">{review.rating} out of 5 stars,</span>
                  <span aria-hidden="true" className="font-mono text-amber-300">{'★'.repeat(review.rating)}</span>
                  {SOURCE[review.source]}
                </span>
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
