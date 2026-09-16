import Link from 'next/link';
import { MessageSquare, Phone, Wrench } from 'lucide-react';
import { BUSINESS } from '@/lib/site';

/** Thumb-reach actions on phones — the fastest path from "interested" to a lead. */
export function MobileActionBar() {
  return (
    <nav
      aria-label="Quick contact"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-carbon/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="grid grid-cols-[1fr_1fr_1.4fr] gap-2 p-2">
        <li>
          <a href={BUSINESS.phoneHref} className="flex h-12 items-center justify-center gap-2 rounded-sm border border-line text-sm font-semibold active:bg-gunmetal">
            <Phone className="size-4 text-clover" aria-hidden="true" /> Call
          </a>
        </li>
        <li>
          <a href={BUSINESS.smsHref} className="flex h-12 items-center justify-center gap-2 rounded-sm border border-line text-sm font-semibold active:bg-gunmetal">
            <MessageSquare className="size-4 text-clover" aria-hidden="true" /> Text
          </a>
        </li>
        <li>
          <Link href="/#quote" className="btn-go flex h-12 items-center justify-center gap-2 rounded-sm text-sm font-bold">
            <Wrench className="size-4" aria-hidden="true" /> Request service
          </Link>
        </li>
      </ul>
    </nav>
  );
}
