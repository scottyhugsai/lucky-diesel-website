'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { PLATFORMS } from '@/lib/site';
import type { PlatformId } from '@/lib/store/normalize';
import { SORTS, productsHref, type SortId, type StoreParams } from './listing';
import { BTN_PRIMARY, FIELD, PILL, TILE } from './styles';

const SELECT = `min-h-12 w-full border border-line bg-carbon px-3 text-chalk ${FIELD}`;
const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-steel [[data-design=v2]_&]:normal-case [[data-design=v2]_&]:tracking-normal';

/** Search, platform, generation and sort. Inline on desktop, bottom sheet on phones. */
export function ProductFilters({ params, resultCount }: { params: StoreParams; resultCount: number }) {
  const router = useRouter();
  const sheet = useRef<HTMLDialogElement>(null);
  // Any change to the filters restarts the listing: page 7 of turbos is not page 7 of fuel.
  const go = (next: Partial<StoreParams>) => router.push(productsHref({ ...params, page: 1, ...next }), { scroll: false });
  const activeCount = [params.platform, params.gen, params.q].filter(Boolean).length;

  const fields = (prefix: string) => {
    const platform = PLATFORMS.find((p) => p.id === params.platform);
    return (
      <>
        <div>
          <label htmlFor={`${prefix}-platform`} className={LABEL}>Platform</label>
          <select id={`${prefix}-platform`} className={SELECT} value={params.platform ?? ''} onChange={(e) => go({ platform: (e.target.value || null) as PlatformId | null, gen: null })}>
            <option value="">All platforms</option>
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${prefix}-gen`} className={LABEL}>Generation</label>
          <select id={`${prefix}-gen`} className={`${SELECT} disabled:opacity-50`} disabled={!platform} value={params.gen ?? ''} onChange={(e) => go({ gen: e.target.value || null })}>
            <option value="">{platform ? 'All generations' : 'Pick a platform first'}</option>
            {platform?.generations.map((name, i) => <option key={name} value={platform.generationCollections[i]}>{name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${prefix}-sort`} className={LABEL}>Sort</label>
          <select id={`${prefix}-sort`} className={SELECT} value={params.sort} onChange={(e) => go({ sort: e.target.value as SortId })}>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </>
    );
  };

  return (
    <div>
      <div className="flex gap-2">
        <form role="search" className="relative flex-1" onSubmit={(e) => { e.preventDefault(); go({ q: String(new FormData(e.currentTarget).get('q') ?? '').trim() }); }}>
          <label htmlFor="store-q" className="sr-only">Search parts</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-steel" aria-hidden="true" />
          <input key={params.q} id="store-q" name="q" type="search" defaultValue={params.q} placeholder="Search parts" className={`min-h-12 w-full border border-line bg-carbon-2 pl-9 pr-3 text-chalk placeholder:text-steel ${FIELD}`} />
        </form>
        <button type="button" onClick={() => sheet.current?.showModal()} className={`flex min-h-12 items-center gap-2 border border-line px-4 font-semibold lg:hidden ${PILL}`}>
          <SlidersHorizontal className="size-4" aria-hidden="true" /> Filters{activeCount > 0 && <span className="tabular-nums text-clover">({activeCount})</span>}
        </button>
      </div>

      <div className="mt-3 hidden grid-cols-3 gap-3 lg:grid">{fields('desk')}</div>

      <dialog
        ref={sheet}
        aria-labelledby="filter-sheet-title"
        className={`fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none border-t border-line bg-carbon-2 p-5 pb-8 text-chalk backdrop:bg-black/60 lg:hidden ${TILE} rounded-b-none [[data-design=v2]_&]:rounded-b-none`}
      >
        <div className="flex items-center justify-between">
          <h2 id="filter-sheet-title" className="display text-3xl not-italic [[data-design=v2]_&]:text-2xl">Filters</h2>
          <button type="button" onClick={() => sheet.current?.close()} aria-label="Close filters" className="grid size-11 place-items-center rounded-full border border-line"><X className="size-5" aria-hidden="true" /></button>
        </div>
        <div className="mt-5 grid gap-4">{fields('sheet')}</div>
        <button type="button" onClick={() => sheet.current?.close()} className={`${BTN_PRIMARY} mt-6 w-full`}>
          Show {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </button>
      </dialog>
    </div>
  );
}
