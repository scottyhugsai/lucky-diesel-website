import Link from 'next/link';
import { Eye } from 'lucide-react';

/** Only an admin with preview on ever sees this, and it says so plainly. */
export function PreviewBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-2 border-t border-amber-300/40 bg-amber-300/15 px-4 py-2 text-center text-xs font-semibold text-chalk backdrop-blur">
      <Eye className="size-3.5 shrink-0 text-amber-300" aria-hidden="true" />
      <span>Preview — you are seeing unpublished drafts.</span>
      <Link href="/admin/site" className="underline underline-offset-2">Site control</Link>
    </div>
  );
}
