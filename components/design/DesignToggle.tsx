'use client';

import { usePathname, useSearchParams } from 'next/navigation';

type Design = 'v1' | 'v2' | 'v3' | 'v4';
const OPTIONS: readonly Design[] = ['v1', 'v2', 'v3', 'v4'];

interface DesignToggleProps {
  design: Design;
  labels: Record<Design, string>;
}

/**
 * Floating switch between the public-site designs. Full navigation so server
 * components re-render with the new cookie. v3 moves it above its tab bar and
 * call pill via the .design-toggle rule in globals.css.
 */
// Demo furniture, so it sits below every real overlay. At z-55 it painted
// across the consent banner's Allow all / Essential only buttons on a phone —
// a pitch affordance covering a legal control.
export function DesignToggle({ design, labels }: DesignToggleProps) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const next = encodeURIComponent(`${pathname}${search ? `?${search}` : ''}`);

  return (
    <div
      // Above the cookie bar: with four designs the row is wide enough to slide
      // under it, and this is the control the whole pitch runs on.
      className="design-toggle fixed bottom-[5.5rem] left-3 z-40 flex items-center gap-0.5 rounded-full border border-line bg-carbon/85 p-0.5 text-[0.7rem] font-semibold shadow-2xl backdrop-blur-xl lg:bottom-5 lg:left-4 lg:gap-1 lg:p-1 lg:text-xs"
      role="group"
      aria-label="Website design"
    >
      {OPTIONS.map((option) => (
        <a
          key={option}
          href={`/design/${option}?next=${next}`}
          aria-current={design === option ? 'true' : undefined}
          className={`rounded-full px-2 py-1 transition-colors lg:px-3 lg:py-1.5 ${design === option ? 'bg-clover text-carbon' : 'text-chalk/80 hover:text-chalk'}`}
        >
          {labels[option]}
        </a>
      ))}
    </div>
  );
}
