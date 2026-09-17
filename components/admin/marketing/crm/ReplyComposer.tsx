'use client';

import { Sparkles } from 'lucide-react';
import { useActionState, useState } from 'react';
import { sendBookLinkAction, sendReplyAction, suggestReplyAction, type DraftState } from '@/app/admin/marketing/contacts/inbox/actions';
import { ActionFeedback } from '@/components/admin/core/ActionForm';
import type { ActionState } from '@/components/admin/ops/form';
import { buttonClass, fieldClass, labelClass } from '@/components/app/ui';

export interface Snippet {
  id: string;
  title: string;
  body: string;
}

interface ReplyComposerProps {
  threadKey: string;
  channel: 'sms' | 'email';
  snippets: readonly Snippet[];
  bookingLink: string;
  shopPhone: string;
  /** Why sending is off (opted out, no address), when it is. */
  blocked: string | null;
}

const MAX = { sms: 320, email: 1200 } as const;

function fill(body: string, bookingLink: string, shopPhone: string): string {
  return body.replaceAll('{{booking_link}}', bookingLink).replaceAll('{{shop_phone}}', shopPhone);
}

/** Reply box with snippets and an AI/template suggested draft. The owner always edits and sends. */
export function ReplyComposer({ threadKey, channel, snippets, bookingLink, shopPhone, blocked }: ReplyComposerProps) {
  const [draftState, suggest, suggesting] = useActionState<DraftState, FormData>(suggestReplyAction, {});
  const [sendState, send, sending] = useActionState<ActionState, FormData>(sendReplyAction, {});
  const [linkState, sendLink, sendingLink] = useActionState<ActionState, FormData>(sendBookLinkAction, {});
  const limit = MAX[channel];

  // A suggested draft fills the box; a successful send empties it. Typing wins
  // until the next suggestion or send, so no effect has to sync the two.
  const base = sendState.notice ? '' : (draftState.draft ?? '').slice(0, limit);
  const [typed, setTyped] = useState<{ base: string; value: string } | null>(null);
  const text = typed && typed.base === base ? typed.value : base;
  const setText = (value: string) => setTyped({ base, value });

  return (
    <div className="grid gap-3 border-t border-line p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="snippet" className={labelClass}>Snippet</label>
          <select
            id="snippet" value="" className={fieldClass}
            onChange={(event) => {
              const snippet = snippets.find((s) => s.id === event.target.value);
              if (snippet) setText(fill(snippet.body, bookingLink, shopPhone).slice(0, limit));
            }}
          >
            <option value="">Pick one…</option>
            {snippets.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
        <form action={suggest}>
          <input type="hidden" name="thread" value={threadKey} />
          <button type="submit" disabled={suggesting} className={buttonClass('secondary')}>
            <Sparkles className="size-4" aria-hidden="true" />
            {suggesting ? 'Drafting…' : 'Suggest'}
          </button>
        </form>
        <form action={sendLink}>
          <input type="hidden" name="thread" value={threadKey} />
          <button type="submit" disabled={sendingLink || Boolean(blocked)} className={buttonClass('ghost')}>
            {sendingLink ? 'Sending…' : 'Send book link'}
          </button>
        </form>
      </div>

      <form action={send} className="grid gap-2">
        <input type="hidden" name="thread" value={threadKey} />
        {channel === 'email' && (
          <>
            <label htmlFor="subject" className="sr-only">Subject</label>
            <input id="subject" name="subject" placeholder="Subject" maxLength={120} className={fieldClass} />
          </>
        )}
        <label htmlFor="body" className="sr-only">Reply</label>
        <textarea
          id="body" name="body" rows={4} required maxLength={limit} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={blocked ?? 'Write a reply…'} disabled={Boolean(blocked)} className={`${fieldClass} min-h-24 resize-y`}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs tabular-nums text-steel">{text.length}/{limit}</p>
          <button type="submit" disabled={sending || Boolean(blocked) || text.trim().length < 2} className={buttonClass('primary')}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
      {blocked && <p className="text-xs text-amber-300">{blocked}</p>}
      <ActionFeedback state={draftState.draft ? { ...draftState, notice: draftState.notice } : draftState} />
      <ActionFeedback state={sendState} />
      <ActionFeedback state={linkState} />
    </div>
  );
}
