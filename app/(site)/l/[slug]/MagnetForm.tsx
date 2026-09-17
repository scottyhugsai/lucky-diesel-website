'use client';

import { useState } from 'react';
import { inputClass } from '@/components/quote/Field';

/** Email-only request for a lead magnet; delivery happens server-side via sendMessage. */
export function MagnetForm({ slug, title, landingSlug }: { slug: string; title: string; landingSlug: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'sent' } | { kind: 'error'; message: string }>({ kind: 'idle' });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: 'sending' });
    const response = await fetch('/api/marketing/content/lead-magnet', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, name, email, company, landingSlug }),
    }).catch(() => null);
    const data: { ok?: boolean; error?: string } = (await response?.json().catch(() => ({}))) ?? {};
    setState(response?.ok && data.ok ? { kind: 'sent' } : { kind: 'error', message: data.error ?? 'That didn’t go through.' });
  }

  if (state.kind === 'sent') return <p role="status" className="text-chalk/85">Sent. Check your inbox for the {title.toLowerCase()}.</p>;
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="sr-only" htmlFor="magnet-name">Name</label>
      <input id="magnet-name" placeholder="Name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass()} />
      <label className="sr-only" htmlFor="magnet-email">Email</label>
      <input id="magnet-email" type="email" placeholder="Email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass()} />
      <button type="submit" disabled={state.kind === 'sending'} className="btn-go display rounded-sm px-5 py-3 text-lg not-italic disabled:opacity-70">Email it</button>
      {state.kind === 'error' && <p role="alert" className="text-sm text-danger sm:col-span-3">{state.message}</p>}
    </form>
  );
}
