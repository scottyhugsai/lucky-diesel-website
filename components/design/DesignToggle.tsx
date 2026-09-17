'use client';

import { usePathname, useSearchParams } from 'next/navigation';

interface DesignToggleProps {
  design: 'v1' | 'v2';
  labels: Record<'v1' | 'v2', string>;
}

/** Floating switch between the two public-site designs. Full navigation so server components re-render with the new cookie. */
export function DesignToggle({ design, labels }: DesignToggleProps) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const next = encodeURIComponent(`${pathname}${search ? `?${search}` : ''}`);

  return (
    <div
      className="fixed bottom-[5.5rem] left-3 z-40 flex items-center gap-0.5 rounded-full border border-line bg-carbon/85 p-0.5 text-[0.7rem] font-semibold shadow-2xl backdrop-blur-xl lg:bottom-5 lg:left-4 lg:gap-1 lg:p-1 lg:text-xs"
      role="group"
      aria-label="Website design"
    >
      <span className="hidden px-2 text-steel lg:inline">Design</span>
      {(['v1', 'v2'] as const).map((option) => (
        <a
          key={option}
          href={`/design/${option}?next=${next}`}
          aria-current={design === option ? 'true' : undefined}
          className={`rounded-full px-2.5 py-1 transition-colors lg:px-3 lg:py-1.5 ${design === option ? 'bg-clover text-carbon' : 'text-chalk/80 hover:text-chalk'}`}
        >
          {labels[option]}
        </a>
      ))}
    </div>
  );
}
