import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { money } from '@/lib/format';
import { USE_CASES } from '@/lib/fitment/use-cases';
import { type Fitment, fitmentParams } from '@/lib/fitment/select';
import { SERVICES } from '@/lib/site';

/**
 * "What's it for?" — the second half of the fitment answer.
 *
 * Every tier states a promise, then the consequence of choosing it, then what
 * it involves and where the price starts. Parts prices are the shop's real
 * lowest listed price; labour is quoted, and says so, because inventing a
 * labour rate would be inventing a business fact.
 */
export function UseCaseTiers({ fitment, current }: { fitment?: Fitment; current?: string | null }) {
  const carried = fitment ? fitmentParams(fitment) : new URLSearchParams();

  return (
    <ul className="grid gap-3 lg:grid-cols-3">
      {USE_CASES.map((useCase) => {
        const parts = useCase.services
          .map((id) => SERVICES.find((service) => service.id === id)?.partsFrom)
          .filter((value): value is number => typeof value === 'number');
        const from = parts.length ? Math.min(...parts) : null;
        const params = new URLSearchParams(carried);
        params.set('goal', useCase.id);

        return (
          <li key={useCase.id} className="v4-tier relative flex flex-col p-5" aria-current={current === useCase.id ? 'true' : undefined}>
            <h3 className="v4-title text-2xl">
              <Link href={`/fitment?${params.toString()}#answer`} className="after:absolute after:inset-0 focus-visible:outline-none">
                {useCase.name}
              </Link>
            </h3>
            <p className="mt-1.5 text-[0.9375rem] font-semibold text-clover">{useCase.promise}</p>
            <p className="mt-3 text-[0.9375rem] leading-snug text-steel">{useCase.consequence}</p>

            <ul className="mt-4 grid gap-1.5 text-sm text-chalk/80">
              {useCase.involves.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-clover" />
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-5">
              <p className="v4-num text-sm text-steel">
                {from !== null ? <>Parts from <span className="text-chalk">{money(from * 100, { whole: true })}</span> · labour quoted</> : 'Quoted per truck'}
              </p>
              <p className="v4-emissions mt-3 flex items-start gap-2 pt-3 text-[0.8125rem] leading-snug">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {useCase.emissions}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function EmissionsNote() {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-steel">
      <span>Every tier keeps the emissions system intact.</span>
      <Link href="/emissions-policy" className="inline-flex min-h-11 items-center gap-1 font-semibold text-chalk underline underline-offset-4 hover:text-clover">
        Read where we stand <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </p>
  );
}
