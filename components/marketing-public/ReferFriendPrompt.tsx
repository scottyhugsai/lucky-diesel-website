'use client';

import { Check, Copy, Gift, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { referralHeadline, referralShareText, type ReferralShare } from '@/lib/marketing/core/referral-share';
import { BUSINESS } from '@/lib/site';

const RESET_MS = 1800;

/**
 * "Refer a friend" card for success screens. Pass `share` when the server already
 * knows the customer (portal); otherwise it asks /api/marketing/referral/me, which
 * returns the signed-in client's link or a generic one.
 */
export function ReferFriendPrompt({ share: initial, className = '' }: { share?: ReferralShare; className?: string }) {
  const [share, setShare] = useState<ReferralShare | null>(initial ?? null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (initial) return;
    const controller = new AbortController();
    fetch('/api/marketing/referral/me', { method: 'POST', signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<ReferralShare>) : null))
      .then((data) => { if (data?.url) setShare(data); })
      .catch(() => { /* aborted or offline: the prompt simply stays hidden */ });
    return () => controller.abort();
  }, [initial]);

  if (!share) return null;
  const text = referralShareText(share, BUSINESS.name);

  async function shareLink(current: ReferralShare) {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: BUSINESS.name, text, url: current.url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${current.url}`);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), RESET_MS);
    } catch {
      window.prompt('Copy this link', current.url);
    }
  }

  return (
    <aside aria-labelledby="refer-friend-heading" className={`grid gap-3 rounded-md border border-line bg-carbon-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5 [[data-design=v2]_&]:rounded-2xl ${className}`}>
      <div className="flex min-w-0 gap-3">
        <Gift className="mt-0.5 size-5 shrink-0 text-clover" aria-hidden="true" />
        <div className="min-w-0">
          <p id="refer-friend-heading" className="font-semibold text-chalk">{referralHeadline(share)}</p>
          <p className="text-sm text-chalk/65">
            {share.code ? <>Your link: <span className="font-mono text-chalk/85">{share.code}</span></> : 'Send them our way.'}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => shareLink(share)}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-clover/60 px-4 text-sm font-semibold text-clover transition-colors hover:bg-clover hover:text-carbon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clover [[data-design=v2]_&]:rounded-full"
      >
        {isCopied ? <Check className="size-4" aria-hidden="true" /> : share.code ? <Share2 className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        <span aria-live="polite">{isCopied ? 'Link copied' : 'Share link'}</span>
      </button>
    </aside>
  );
}
