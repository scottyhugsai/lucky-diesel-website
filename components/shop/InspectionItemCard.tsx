'use client';

import { ChevronDown, Trash, Wrench } from 'lucide-react';
import { useOptimistic, useState, useTransition } from 'react';
import { RATING_META, type Rating } from '@/app/shop/_lib/inspection';
import type { ActionState } from '@/app/shop/_lib/form';
import { deleteInspectionItem, setItemRating } from '@/app/shop/jobs/[id]/_inspection/actions';
import { Badge } from '@/components/app/ui';
import type { Enums } from '@/lib/db/database.types';
import { money } from '@/lib/format';
import { FormMessage } from './FormMessage';
import { MediaThumbs, type MediaThumb } from './MediaThumbs';
import { MediaUploader } from './MediaUploader';
import { RatingToggle } from './RatingToggle';
import { RecommendForm } from './RecommendForm';
import { useShopForm } from './useShopForm';

export interface ItemLine {
  id: string;
  kind: Enums<'line_item_kind'>;
  description: string;
  quantity: number;
  unitPriceCents: number;
  approval: Enums<'approval_state'>;
}

interface InspectionItemCardProps {
  workOrderId: string;
  item: { id: string; category: string; label: string; notes: string | null; rating: Enums<'inspection_rating'> };
  media: MediaThumb[];
  lines: ItemLine[];
  draft: boolean;
  laborRateCents: number;
}

const APPROVAL_TONE = { pending: 'neutral', approved: 'good', declined: 'bad' } as const;
const EDGE: Record<Rating | 'na', string> = { green: 'bg-clover', yellow: 'bg-amber-300', red: 'bg-danger', na: 'bg-steel/40' };

export function InspectionItemCard({ workOrderId, item, media, lines, draft, laborRateCents }: InspectionItemCardProps) {
  const [rating, setOptimisticRating] = useOptimistic<Enums<'inspection_rating'>, Rating>(item.rating, (_current, next) => next);
  const [ratingState, setRatingState] = useState<ActionState>({});
  const [, startTransition] = useTransition();
  const [showRecommend, setShowRecommend] = useState(false);
  const remove = useShopForm(deleteInspectionItem);
  const needsWork = rating === 'red' || rating === 'yellow';

  function changeRating(next: Rating) {
    startTransition(async () => {
      setOptimisticRating(next);
      const result = await setItemRating(workOrderId, item.id, next);
      setRatingState(result.error ? result : {});
    });
  }

  return (
    <article className="relative overflow-hidden rounded-md border border-line bg-carbon-2" aria-label={`${item.category}: ${item.label}`}>
      <span className={`absolute inset-y-0 left-0 w-1.5 ${EDGE[rating]}`} aria-hidden="true" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4 pl-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-steel">{item.category}</p>
            <h3 className="mt-0.5 text-lg font-semibold leading-snug text-chalk">{item.label}</h3>
            {item.notes && <p className="mt-1 text-sm text-chalk/70">{item.notes}</p>}
          </div>
          <span className={`max-w-[40%] text-right text-xs font-bold uppercase leading-tight ${RATING_META[rating].tone}`}>{RATING_META[rating].label}</span>
        </header>

        {draft && <RatingToggle value={rating} onChange={changeRating} label={`Condition of ${item.label}`} size="md" />}
        <FormMessage state={ratingState} />

        <MediaThumbs media={media} />
        {draft && <MediaUploader workOrderId={workOrderId} itemId={item.id} />}

        {lines.length > 0 && (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5 border-t border-line pt-3">
            {lines.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <Wrench className="mr-1.5 inline size-3.5 text-steel" aria-hidden="true" />
                  {line.description} <span className="text-steel">· {line.kind === 'labor' ? `${line.quantity} h` : `×${line.quantity}`}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-mono tabular-nums">{money(Math.round(line.quantity * line.unitPriceCents))}</span>
                  <Badge tone={APPROVAL_TONE[line.approval]}>{line.approval}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}

        {needsWork && draft && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
            <button
              type="button"
              aria-expanded={showRecommend}
              onClick={() => setShowRecommend((open) => !open)}
              className="flex h-12 items-center justify-between rounded-sm border border-chalk/20 px-3 font-semibold text-chalk transition-colors hover:border-clover hover:text-clover"
            >
              <span className="flex items-center gap-2"><Wrench className="size-4" aria-hidden="true" /> Add recommended work</span>
              <ChevronDown className={`size-5 transition-transform ${showRecommend ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {showRecommend && <RecommendForm workOrderId={workOrderId} itemId={item.id} laborRateCents={laborRateCents} />}
          </div>
        )}

        {draft && (
          <form onSubmit={remove.onSubmit} className="flex items-center justify-end gap-3">
            <input type="hidden" name="workOrderId" value={workOrderId} />
            <input type="hidden" name="itemId" value={item.id} />
            <FormMessage state={remove.state} />
            <button type="submit" disabled={remove.pending} className="inline-flex h-11 items-center gap-1.5 rounded-sm px-3 text-sm font-semibold text-steel hover:bg-danger/10 hover:text-danger disabled:opacity-50">
              <Trash className="size-4" aria-hidden="true" /> Remove item
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
