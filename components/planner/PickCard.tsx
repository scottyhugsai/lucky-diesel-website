'use client';

import Image from 'next/image';
import Link from 'next/link';
import { CircleCheck, CircleHelp, Leaf, TriangleAlert } from 'lucide-react';
import { money } from '@/lib/format';
import type { Emissions, PlanPick } from './recommend';
import { BADGE, SURFACE } from './ui';

const EMISSIONS: Record<Emissions, { label: string; className: string; Icon: typeof Leaf }> = {
  offroad: { label: 'Off-road use only', className: 'border-danger/50 text-danger', Icon: TriangleAlert },
  compliant: { label: 'Emissions-compliant', className: 'border-clover/50 text-clover', Icon: Leaf },
  confirm: { label: 'Emissions status: ask us', className: 'border-line text-steel', Icon: CircleHelp },
};

interface PickCardProps {
  pick: PlanPick;
  onSwap: (variantId: number) => void;
}

const optionLabel = (title: string, variantTitle: string | null, priceCents: number) =>
  `${title}${variantTitle ? ` · ${variantTitle}` : ''} · ${money(priceCents)}`;

export function PickCard({ pick, onSwap }: PickCardProps) {
  const { product, variant } = pick;
  const image = variant.image ?? product.image?.src ?? null;
  const emissions = EMISSIONS[pick.emissions];
  const swapId = `swap-${pick.slot}`;

  return (
    <article className={`${SURFACE} grid grid-cols-[minmax(0,1fr)] gap-4 p-3 sm:p-4`}>
      <div className="flex gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-sm bg-chalk sm:size-24 [[data-design=v2]_&]:rounded-2xl">
          {image && <Image src={image} alt="" fill sizes="96px" className="object-contain p-1.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-steel [[data-design=v2]_&]:normal-case [[data-design=v2]_&]:tracking-normal">{pick.slotName}</p>
          <h3 className="mt-1 line-clamp-2 font-semibold leading-snug">
            <Link href={`/store/products/${product.handle}`} className="hover:text-clover hover:underline">{product.title}</Link>
          </h3>
          {variant.title && <p className="mt-0.5 truncate text-sm text-chalk/65">{variant.title}</p>}
          <p className="mt-1 text-lg font-bold tabular-nums [[data-design=v2]_&]:font-semibold">{money(variant.priceCents)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {pick.fit === 'fits' ? (
          <span className={`${BADGE} border-clover/50 text-clover`}><CircleCheck className="size-3.5" aria-hidden="true" /> Fits your truck</span>
        ) : (
          <span className={`${BADGE} border-chalk/30 text-chalk/80`}><CircleHelp className="size-3.5" aria-hidden="true" /> Confirm fit</span>
        )}
        <span className={`${BADGE} ${emissions.className}`}><emissions.Icon className="size-3.5" aria-hidden="true" /> {emissions.label}</span>
        {pick.confirmYear && <span className={`${BADGE} border-line text-steel`}>Match your model year</span>}
      </div>

      {pick.alternatives.length > 0 && (
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <label htmlFor={swapId} className="shrink-0 text-sm font-semibold text-chalk/80">Swap</label>
          <select
            id={swapId}
            value={variant.id}
            onChange={(event) => onSwap(Number(event.target.value))}
            className="h-11 w-full min-w-0 rounded-sm border border-line bg-carbon px-3 text-sm text-chalk hover:border-chalk/30 focus:border-clover focus:outline-none [[data-design=v2]_&]:rounded-full [[data-design=v2]_&]:px-4"
          >
            <option value={variant.id}>{optionLabel(product.title, variant.title, variant.priceCents)}{pick.swapped ? ' (your pick)' : ' (recommended)'}</option>
            {pick.alternatives.map((alt) => (
              <option key={alt.variantId} value={alt.variantId}>
                {optionLabel(alt.title, alt.variantTitle, alt.priceCents)}{alt.fit === 'platform' ? ' (confirm fit)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
    </article>
  );
}
