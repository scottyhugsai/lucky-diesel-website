'use client';

import { BellRing, Check } from 'lucide-react';
import { useState } from 'react';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done' } | { kind: 'error'; message: string };

interface NotifyMeFormProps {
  /** e.g. `product:s-b-intake` or `tune:duramax-l5p`. */
  topic: string;
  label: string;
  heading?: string;
  /** Where to post. Product pages use `/api/marketing/stock-alert`, which checks stock daily. */
  endpoint?: string;
}

/** "Notify me" waitlist: one email when the owner sends the notice. */
export function NotifyMeForm({ topic, label, heading = 'Get notified', endpoint = '/api/marketing/waitlist' }: NotifyMeFormProps) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus({ kind: 'sending' });
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, label, email: String(data.get('email') ?? ''), company: String(data.get('company') ?? '') }),
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      setStatus(response.ok && body.ok ? { kind: 'done' } : { kind: 'error', message: body.error ?? 'Couldn’t save. Try again.' });
    } catch {
      setStatus({ kind: 'error', message: 'No connection. Try again.' });
    }
  }

  if (status.kind === 'done') {
    return <p role="status" className="flex items-center gap-2 rounded-sm border border-clover/40 bg-clover/10 p-3 text-sm [[data-design=v2]_&]:rounded-xl"><Check className="size-4 text-clover" aria-hidden="true" /> You’re on the list. One email when it’s back.</p>;
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-sm border border-line p-4 [[data-design=v2]_&]:rounded-xl" aria-label={`${heading}: ${label}`}>
      <p className="flex items-center gap-2 font-semibold"><BellRing className="size-4 text-clover" aria-hidden="true" /> {heading}</p>
      <div className="flex gap-2">
        <label htmlFor={`notify-${topic}`} className="sr-only">Email</label>
        <input id={`notify-${topic}`} name="email" type="email" required autoComplete="email" placeholder="Email" className="h-11 min-w-0 flex-1 rounded-sm border border-line bg-carbon px-3 text-base text-chalk placeholder:text-steel/70 focus:border-clover focus:outline-none focus:ring-2 focus:ring-clover/30 [[data-design=v2]_&]:rounded-lg" />
        <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <button type="submit" disabled={status.kind === 'sending'} className="btn-go h-11 shrink-0 rounded-sm px-4 text-sm font-bold disabled:opacity-60 [[data-design=v2]_&]:rounded-lg">
          {status.kind === 'sending' ? 'Saving…' : 'Notify me'}
        </button>
      </div>
      {status.kind === 'error' && <p role="alert" className="text-sm text-danger">{status.message}</p>}
    </form>
  );
}
