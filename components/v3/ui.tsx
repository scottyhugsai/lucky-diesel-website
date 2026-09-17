import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/** Shared Telemetry class recipes. Mono for every number, 6px radius on controls, 0px on data chips. */
export const WRAP = 'mx-auto w-full max-w-[1200px] px-4 sm:px-6';
export const SECTION = 'py-[clamp(2.5rem,8vw,5rem)]';
export const MONO = 'v3-mono tabular-nums';
export const CARD = 'rounded-[8px] border border-line bg-carbon-2';
export const CHIP = 'v3-chip inline-flex items-center gap-1.5 border border-line px-2 py-1 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-steel';
export const BTN = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] px-4 text-[0.9375rem] font-semibold transition-[transform,filter,background-color,border-color] duration-150 active:scale-[0.98]';
export const BTN_PRIMARY = `${BTN} bg-clover text-carbon hover:brightness-110`;
export const BTN_GHOST = `${BTN} border border-line text-chalk hover:border-chalk/40`;

interface SectionHeadProps {
  id: string;
  index: string;
  title: string;
  line?: string;
  href?: string;
  linkLabel?: string;
}

/** Numbered section header: mono index like a readout label, short title, optional "See all" link. */
export function SectionHead({ id, index, title, line, href, linkLabel = 'See all' }: SectionHeadProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className={`${MONO} text-xs text-clover`}>{index}</p>
        <h2 id={id} className="v3-title mt-1.5 text-[clamp(1.5rem,1.1rem+1.8vw,2.25rem)]">{title}</h2>
        {line && <p className="mt-1.5 max-w-md text-[0.9375rem] text-chalk/65">{line}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-clover hover:underline underline-offset-4">
          {linkLabel} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
