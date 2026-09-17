'use client';

import { MessageSquare, Phone, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SMS_CONSENT_TEXT } from '@/lib/lead';
import { BUSINESS } from '@/lib/site';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string };

const inputClass = 'h-11 w-full rounded-sm border border-line bg-carbon px-3 text-[0.95rem] text-chalk placeholder:text-steel/70 focus:border-clover focus:outline-none focus:ring-2 focus:ring-clover/30 [[data-design=v2]_&]:rounded-lg';

export function TextUsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const get = (key: string) => String(data.get(key) ?? '').trim();
    setStatus({ kind: 'sending' });
    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: get('name'), phone: get('phone'), email: get('email'), platform: 'other', generation: '', mileage: '', service: 'other',
          details: `[widget:text-us] ${get('message') || 'Please get in touch.'}`, smsConsent: data.get('sms') === 'on', company: get('company'),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; errors?: Record<string, string>; message?: string };
      if (!response.ok || !body.ok) {
        const first = body.errors ? Object.values(body.errors)[0] : body.message;
        setStatus({ kind: 'error', message: first ?? 'That didn’t send. Call or text instead.' });
        return;
      }
      setStatus({ kind: 'sent' });
    } catch {
      setStatus({ kind: 'error', message: 'No connection. Call or text instead.' });
    }
  }

  return (
    <div
      ref={panelRef}
      id="text-us-panel"
      role="dialog"
      aria-label="Contact Lucky Diesel"
      hidden={!isOpen}
      className="absolute bottom-14 right-0 w-[min(22rem,calc(100vw-1.5rem))] rounded-md border border-line bg-carbon-2 p-4 shadow-2xl[[data-design=v2]_&]:rounded-2xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="display text-xl not-italic">Talk to a tech</p>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-sm text-chalk/70 hover:bg-gunmetal hover:text-chalk">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a href={BUSINESS.smsHref} className="btn-go flex h-11 items-center justify-center gap-2 rounded-sm text-sm font-bold [[data-design=v2]_&]:rounded-lg"><MessageSquare className="size-4" aria-hidden="true" /> Text</a>
        <a href={BUSINESS.phoneHref} className="flex h-11 items-center justify-center gap-2 rounded-sm border border-line text-sm font-semibold hover:border-clover [[data-design=v2]_&]:rounded-lg"><Phone className="size-4 text-clover" aria-hidden="true" /> Call</a>
      </div>
      {status.kind === 'sent' ? (
        <p role="status" className="mt-4 rounded-sm border border-clover/40 bg-clover/10 p-3 text-sm">Got it. We’ll reach out soon.</p>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-2 border-t border-line pt-4" aria-label="Quick message">
          <p className="text-sm text-chalk/70">Or leave a quick note.</p>
          <label className="sr-only" htmlFor="tu-name">Name</label>
          <input id="tu-name" name="name" required autoComplete="name" placeholder="Name" className={inputClass} />
          <div className="grid grid-cols-2 gap-2">
            <label className="sr-only" htmlFor="tu-phone">Phone</label>
            <input id="tu-phone" name="phone" type="tel" required autoComplete="tel" placeholder="Phone" className={inputClass} />
            <label className="sr-only" htmlFor="tu-email">Email</label>
            <input id="tu-email" name="email" type="email" required autoComplete="email" placeholder="Email" className={inputClass} />
          </div>
          <label className="sr-only" htmlFor="tu-message">Message</label>
          <textarea id="tu-message" name="message" rows={2} minLength={5} required maxLength={500} placeholder="What’s the truck doing?" className={`${inputClass} h-auto py-2`} />
          <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
          <label className="flex items-start gap-2 text-[0.7rem] leading-snug text-steel">
            <input type="checkbox" name="sms" className="mt-0.5 size-4 shrink-0 accent-clover" />
            <span>{SMS_CONSENT_TEXT}</span>
          </label>
          {status.kind === 'error' && <p role="alert" className="text-sm text-danger">{status.message}</p>}
          <button type="submit" disabled={status.kind === 'sending'} className="btn-go h-11 rounded-sm text-sm font-bold disabled:opacity-60 [[data-design=v2]_&]:rounded-lg">
            {status.kind === 'sending' ? 'Sending…' : 'Send note'}
          </button>
        </form>
      )}
    </div>
  );
}
