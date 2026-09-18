import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import type { BlockValues } from '@/lib/site-content/fields';
import { bool, str } from '@/lib/site-content/values';

/**
 * Owner-controlled line under the header. Shares the notice slot with the
 * closure banner (which wins — shop hours matter more than a promotion), so the
 * per-design offsets here mirror ClosureBanner's.
 */
export function AnnouncementBar({ values }: { values: BlockValues }) {
  if (!bool(values, 'enabled')) return null;
  const text = str(values, 'text');
  if (!text) return null;
  const label = str(values, 'linkLabel');
  const href = str(values, 'href');
  const highlighted = str(values, 'tone') === 'offer';

  return (
    <aside
      aria-label="Announcement"
      className={`fixed inset-x-0 top-18 z-40 border-b px-4 py-1.5 text-center text-sm backdrop-blur-xl [[data-design=v2]_&]:top-12 [[data-design=v3]_&]:top-14 ${
        highlighted ? 'border-clover/40 bg-clover/12 text-chalk' : 'border-line bg-carbon/95 text-chalk'
      }`}
    >
      <p className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <Megaphone className={`size-4 shrink-0 ${highlighted ? 'text-clover' : 'text-steel'}`} aria-hidden="true" />
        <span>{text}</span>
        {label && href && (
          <Link href={href} className="font-semibold text-clover underline-offset-4 hover:underline">{label}</Link>
        )}
      </p>
    </aside>
  );
}
