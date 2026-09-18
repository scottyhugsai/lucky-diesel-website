import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { money } from '@/lib/format';
import { USE_CASES, partsFloorCents } from '@/lib/fitment/use-cases';

/**
 * The tiers as a ladder rather than a card row.
 *
 * Three equal cards say the three options are equivalent. They are not: they
 * run light to heavy, and reading them top to bottom is reading the axis. On a
 * page that already stacks three-up rows either side of this one, bands also
 * break a rhythm that had stopped carrying information.
 *
 * /fitment keeps the cards, where the tiers are the answer and not a preview.
 */
export function UseCaseLadder() {
  return (
    <ol className="v4-stagger mt-8 divide-y divide-line border-y border-line">
      {USE_CASES.map((useCase) => {
        const from = partsFloorCents(useCase);
        return (
          <li key={useCase.id} className="group relative grid gap-4 py-7 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,11rem)] lg:gap-10">
            <div>
              <h3 className="v4-title text-2xl">
                <Link href={`/fitment?goal=${useCase.id}`} className="after:absolute after:inset-0 focus-visible:outline-none group-hover:text-clover">
                  {useCase.name}
                </Link>
              </h3>
              <p className="mt-1 text-[0.9375rem] font-semibold text-clover">{useCase.promise}</p>
            </div>

            <div>
              <p className="text-[0.9375rem] leading-snug text-steel">{useCase.consequence}</p>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-chalk/80">
                {useCase.involves.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-clover" />
                    {line}
                  </li>
                ))}
              </ul>
              {/* Stated per tier, not once for the section: it is a promise each
                  one makes, and the fast tier is the one people doubt. */}
              <p className="v4-emissions mt-3 inline-flex items-center gap-2 pt-3 text-[0.8125rem]">
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                {useCase.emissions}
              </p>
            </div>

            <div className="lg:text-right">
              <p className="v4-num text-sm leading-relaxed text-steel">
                {from !== null ? (
                  <>
                    Parts from <span className="text-chalk">{money(from, { whole: true })}</span>
                    <span className="block text-xs">Labour quoted separately</span>
                  </>
                ) : (
                  'Quoted per truck'
                )}
              </p>
              <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-chalk group-hover:text-clover">
                See it on your truck
                <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
