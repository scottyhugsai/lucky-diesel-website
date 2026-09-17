'use client';

import { useState } from 'react';
import { approveAndPost, draftReply } from '@/app/admin/marketing/reviews/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge } from '@/components/app/ui';
import { SampleTag, Stars, areaClass, shortDate } from './kit';
import { REPLY_TONES, TONE_LABELS, toneReply } from './reply-tones';
import type { ReviewView } from './reviews-data';

const SOURCE_LABEL: Record<string, string> = { google: 'Google', facebook: 'Facebook', manual: 'Manual', internal: 'Private note', sample: 'Sample' };

function ReplyEditor({ review }: { review: ReviewView }) {
  const reply = review.reply!;
  const [text, setText] = useState(reply.text);
  const showAck = reply.compliance === 'warn' || reply.issues.length > 0;
  return (
    <ActionForm action={approveAndPost} className="mt-3 grid gap-2">
      <input type="hidden" name="reply_id" value={reply.id} />
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tone">
        <span className="text-xs font-semibold uppercase tracking-widest text-steel">Tone</span>
        {REPLY_TONES.map((tone) => (
          <button key={tone} type="button" onClick={() => setText(toneReply(tone, review.rating, review.author))} className="h-8 rounded-sm border border-line px-2.5 text-xs font-semibold text-chalk/80 hover:border-clover hover:text-clover">
            {TONE_LABELS[tone]}
          </button>
        ))}
      </div>
      <label htmlFor={`reply-${reply.id}`} className="sr-only">Reply text</label>
      <textarea id={`reply-${reply.id}`} name="text" rows={3} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} className={areaClass} />
      {reply.issues.length > 0 && <p className="text-xs text-amber-300">{reply.issues.join(' ')}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <PendingButton size="sm">Approve &amp; post</PendingButton>
        {showAck && (
          <label className="flex items-center gap-2 text-xs text-chalk/75">
            <input type="checkbox" name="ack" className="size-4 accent-clover" /> I checked it
          </label>
        )}
      </div>
    </ActionForm>
  );
}

export function ReviewItem({ review }: { review: ReviewView }) {
  const reply = review.reply;
  const isPosted = reply && (reply.status === 'posted' || reply.status === 'simulated');
  const canReply = review.source !== 'internal';
  return (
    <li className={`rounded-md border bg-carbon-2 p-4 sm:p-5 ${review.rating <= 3 ? 'border-danger/40' : 'border-line'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Stars rating={review.rating} />
        <p className="font-semibold">{review.author.replace(/^Sample\s*[—-]\s*/i, '')}</p>
        {review.isSample && <SampleTag />}
        {review.source !== 'sample' && <Badge>{SOURCE_LABEL[review.source] ?? review.source}</Badge>}
        <span className="ml-auto text-xs text-steel">{shortDate(review.reviewedAt)}</span>
      </div>
      {review.body && <p className="mt-2 text-chalk/85">{review.body}</p>}

      {canReply && isPosted && (
        <div className="mt-3 border-l-2 border-clover/60 pl-3 text-sm text-chalk/75">
          <p className="mb-1 text-xs font-semibold text-clover">{reply.status === 'posted' ? 'Posted' : 'Replied (demo)'} · {shortDate(reply.postedAt)}</p>
          {reply.text}
        </div>
      )}
      {canReply && !isPosted && reply && <ReplyEditor review={review} />}
      {canReply && !reply && !review.replied && (
        <ActionForm action={draftReply} className="mt-3">
          <input type="hidden" name="review_id" value={review.id} />
          <PendingButton size="sm" variant="secondary">Draft reply</PendingButton>
        </ActionForm>
      )}
      {canReply && !reply && review.replied && <p className="mt-3 text-xs text-steel">Replied outside the app.</p>}
      {!canReply && <p className="mt-3 text-xs text-steel">Private feedback. Not public, no reply.</p>}
    </li>
  );
}
