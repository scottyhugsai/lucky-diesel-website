'use client';

import { ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { PopupRule } from '@/lib/marketing/engage/rules';

function beacon(event: 'popup_view' | 'popup_click', popupId: string): void {
  void fetch('/api/marketing/track', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', keepalive: true,
    body: JSON.stringify({ event, popupId }),
  }).catch(() => undefined);
}

/** Page-specific offer popup fired by time on page or scroll depth. Views and clicks are counted. */
export function PopupDialog({ popup, onClose }: { popup: PopupRule; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    beacon('popup_view', popup.id);
  }, [popup.id]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="page-popup-title"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-md border border-line bg-carbon-2 p-0 text-chalk backdrop:bg-black/70 [[data-design=v2]_&]:rounded-3xl"
      onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}
    >
      <div className="relative grid gap-4 p-6 sm:p-7">
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close" className="absolute right-3 top-3 grid size-10 place-items-center rounded-sm text-chalk/70 hover:bg-gunmetal hover:text-chalk">
          <X className="size-5" aria-hidden="true" />
        </button>
        <h2 id="page-popup-title" className="display pr-8 text-3xl">{popup.headline}</h2>
        {popup.body && <p className="text-chalk/75">{popup.body}</p>}
        <Link
          href={popup.ctaHref}
          onClick={() => { beacon('popup_click', popup.id); dialogRef.current?.close(); }}
          className="btn-go display inline-flex h-12 items-center justify-center gap-2 rounded-sm text-lg not-italic [[data-design=v2]_&]:rounded-full"
        >
          {popup.ctaLabel} <ArrowRight className="size-5" aria-hidden="true" />
        </Link>
        <button type="button" onClick={() => dialogRef.current?.close()} className="text-sm text-steel underline-offset-4 hover:underline">No thanks</button>
      </div>
    </dialog>
  );
}
