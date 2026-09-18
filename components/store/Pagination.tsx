import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pageWindow, productsHref, type PageSlice, type StoreParams } from './listing';
import { PILL } from './styles';

const STEP = `inline-flex min-h-11 items-center gap-1 border border-line px-4 font-semibold transition-colors hover:border-clover hover:text-clover ${PILL}`;
const NUM = `grid min-h-11 min-w-11 place-items-center border px-2 text-sm font-semibold tabular-nums transition-colors ${PILL}`;

/**
 * Plain links, no JavaScript: every page of the listing is its own URL, the same
 * way the truck picker is. `rel` prev/next tells a crawler the pages are a series.
 */
export function Pagination({ params, slice }: { params: StoreParams; slice: PageSlice<unknown> }) {
  if (slice.pages < 2) return null;
  const href = (page: number) => productsHref({ ...params, page });

  return (
    <nav aria-label="Parts pages" className="mt-10 flex flex-col items-center gap-4 border-t border-line pt-6">
      <p className="text-sm text-steel tabular-nums">
        Showing <span className="text-chalk">{slice.from}–{slice.to}</span> of {slice.total}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {slice.page > 1 ? (
          <Link href={href(slice.page - 1)} rel="prev" className={STEP}>
            <ChevronLeft className="size-4" aria-hidden="true" /> Back
          </Link>
        ) : (
          <span className={`${STEP} pointer-events-none opacity-40`} aria-hidden="true">
            <ChevronLeft className="size-4" /> Back
          </span>
        )}

        <ol className="flex items-center gap-1">
          {pageWindow(slice.page, slice.pages).map((page, i) =>
            page === null ? (
              <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-steel">…</li>
            ) : (
              <li key={page}>
                <Link
                  href={href(page)}
                  aria-label={`Page ${page}`}
                  aria-current={page === slice.page ? 'page' : undefined}
                  className={`${NUM} ${page === slice.page ? 'border-clover bg-clover text-carbon' : 'border-line hover:border-clover'}`}
                >
                  {page}
                </Link>
              </li>
            ),
          )}
        </ol>

        {slice.page < slice.pages ? (
          <Link href={href(slice.page + 1)} rel="next" className={STEP}>
            Next <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className={`${STEP} pointer-events-none opacity-40`} aria-hidden="true">
            Next <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
