import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const WRAP = 'mx-auto w-full max-w-[1180px] px-5 sm:px-8';
export const SECTION = 'py-14 sm:py-18';

export const BTN_PRIMARY =
  'btn-go inline-flex min-h-12 items-center justify-center gap-2 px-6 text-[0.9375rem] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clover';

export const BTN_GHOST =
  'btn-ghost inline-flex min-h-12 items-center justify-center gap-2 rounded-[2px] border border-line px-6 text-[0.9375rem] font-semibold text-chalk transition-colors duration-150 hover:border-chalk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clover';

/** Small uppercase label with a rule running off to the right. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="kicker flex items-center gap-3">
      {children}
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </p>
  );
}

interface HeadProps {
  id: string;
  index?: string;
  title: string;
  line?: string;
  href?: string;
  linkLabel?: string;
}

export function SectionHead({ id, index, title, line, href, linkLabel = 'See all' }: HeadProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="max-w-xl">
        {index && <p className="kicker">{index}</p>}
        <h2 id={id} className="v4-title mt-2.5 text-[length:var(--text-display)]">{title}</h2>
        {line && <p className="mt-3 text-base leading-snug text-steel sm:text-lg">{line}</p>}
      </div>
      {href && (
        <Link href={href} className="group inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-semibold text-chalk hover:text-clover">
          {linkLabel}
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
