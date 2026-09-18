import { CalendarX2 } from 'lucide-react';
import { type Closure, closureText } from '@/lib/marketing/content/seo-local';
import { BUSINESS } from '@/lib/site';

/**
 * Holiday / special-hours notice, a week ahead through the last closed day.
 * Pinned just under each design's fixed header (v1 4.5rem, v2 3rem, v3 3.5rem).
 */
export function ClosureBanner({ closure }: { closure: Closure }) {
  return (
    <aside aria-label="Shop hours notice" className="fixed inset-x-0 top-18 z-40 border-b border-amber-300/30 bg-carbon/95 px-4 py-1.5 text-center text-sm text-chalk backdrop-blur-xl [[data-design=v2]_&]:top-12 [[data-design=v3]_&]:top-14">
      <p className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <CalendarX2 className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
        <span>{closureText(closure)}</span>
        <a href={BUSINESS.smsHref} className="font-semibold text-clover underline-offset-4 hover:underline">Text us</a>
      </p>
    </aside>
  );
}
