import { MessageSquare, Phone } from 'lucide-react';
import { BUSINESS } from '@/lib/site';

/** Thumb-zone contact pill. Floats above the tab bar on phones; docks bottom-right on desktop. */
export function CallTextPill() {
  return (
    <nav aria-label="Quick contact" className="v3-pill fixed right-3 z-40 flex items-stretch rounded-full border border-line shadow-[0_10px_30px_-10px_rgb(0_0_0/0.8)] lg:right-6">
      <a href={BUSINESS.phoneHref} aria-label={`Call ${BUSINESS.phoneDisplay}`} className="flex h-11 items-center gap-1.5 rounded-l-full pl-4 pr-3 text-sm font-semibold text-carbon active:brightness-95">
        <Phone className="size-4" aria-hidden="true" /> Call
      </a>
      <span aria-hidden="true" className="my-2 w-px bg-carbon/25" />
      <a href={BUSINESS.smsHref} aria-label={`Text ${BUSINESS.phoneDisplay}`} className="flex h-11 items-center gap-1.5 rounded-r-full pl-3 pr-4 text-sm font-semibold text-carbon active:brightness-95">
        <MessageSquare className="size-4" aria-hidden="true" /> Text
      </a>
    </nav>
  );
}
