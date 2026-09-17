'use client';

import { ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { markOfferSeen } from './hooks';
import type { WidgetMagnet, WidgetOffer } from './widget-data';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; email: string } | { kind: 'error'; message: string };

const CONSENT_VERSION = '2026-09-17-offer-popup';
const CONSENT_TEXT = 'Email me diesel tips and shop offers from Lucky Diesel. Unsubscribe anytime.';
const inputClass = 'h-12 w-full rounded-sm border border-line bg-carbon px-3 text-base text-chalk placeholder:text-steel/70 focus:border-clover focus:outline-none focus:ring-2 focus:ring-clover/30 [[data-design=v2]_&]:rounded-lg';

interface OfferDialogProps {
  magnet: WidgetMagnet | null;
  offer: WidgetOffer | null;
  onClose: () => void;
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  return { ok: response.ok && data.ok !== false, error: data.error };
}

/** Accessible modal (native dialog: focus trap, Esc, inert background). Honest copy, no fake urgency. */
export function OfferDialog({ magnet, offer, onClose }: OfferDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    markOfferSeen();
  }, []);

  async function claim(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!magnet) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    setStatus({ kind: 'sending' });
    try {
      if (data.get('consent') === 'on') {
        await postJson('/api/marketing/consent', {
          channel: 'email', purpose: 'marketing', action: 'granted', email, fullName: name,
          consentTextVersion: CONSENT_VERSION, consentText: CONSENT_TEXT, sourceUrl: window.location.href,
        });
      }
      const sent = await postJson('/api/marketing/content/lead-magnet', { slug: magnet.slug, name, email, company: String(data.get('company') ?? '') });
      setStatus(sent.ok ? { kind: 'sent', email } : { kind: 'error', message: sent.error ?? 'That didn’t send. Try again.' });
    } catch {
      setStatus({ kind: 'error', message: 'No connection. Try again.' });
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="offer-dialog-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-md border border-line bg-carbon-2 p-0 text-chalk backdrop:bg-black/70 [[data-design=v2]_&]:rounded-3xl"
      onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}
    >
      <div className="relative grid gap-4 p-6 sm:p-7">
        <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close" className="absolute right-3 top-3 grid size-10 place-items-center rounded-sm text-chalk/70 hover:bg-gunmetal hover:text-chalk">
          <X className="size-5" aria-hidden="true" />
        </button>
        {magnet ? (
          <>
            <p className="kicker">Free checklist</p>
            <h2 id="offer-dialog-title" className="display pr-8 text-3xl">{magnet.title}</h2>
            <p className="text-chalk/75">{magnet.description}</p>
            {status.kind === 'sent' ? (
              <p role="status" className="rounded-sm border border-clover/40 bg-clover/10 p-3">Sent to {status.email}. Check your inbox.</p>
            ) : (
              <form onSubmit={claim} className="grid gap-3" aria-label="Get the checklist">
                <label className="sr-only" htmlFor="od-name">Name</label>
                <input id="od-name" name="name" required minLength={2} autoComplete="given-name" placeholder="First name" className={inputClass} />
                <label className="sr-only" htmlFor="od-email">Email</label>
                <input id="od-email" name="email" type="email" required autoComplete="email" placeholder="Email" className={inputClass} />
                <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                <label className="flex items-start gap-2 text-sm text-chalk/70">
                  <input type="checkbox" name="consent" className="mt-0.5 size-4 shrink-0 accent-clover" />
                  <span>{CONSENT_TEXT}</span>
                </label>
                {status.kind === 'error' && <p role="alert" className="text-sm text-danger">{status.message}</p>}
                <button type="submit" disabled={status.kind === 'sending'} className="btn-go display h-12 rounded-sm text-lg not-italic disabled:opacity-60 [[data-design=v2]_&]:rounded-full">
                  {status.kind === 'sending' ? 'Sending…' : 'Email it to me'}
                </button>
              </form>
            )}
          </>
        ) : offer ? (
          <>
            <p className="kicker">Current offer</p>
            <h2 id="offer-dialog-title" className="display pr-8 text-3xl">{offer.headline}</h2>
            <p className="display text-4xl text-clover">{offer.valueLabel}</p>
            <Link href={offer.href} onClick={() => dialogRef.current?.close()} className="btn-go display inline-flex h-12 items-center justify-center gap-2 rounded-sm text-lg not-italic [[data-design=v2]_&]:rounded-full">
              See details <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </>
        ) : null}
        <button type="button" onClick={() => dialogRef.current?.close()} className="text-sm text-steel underline-offset-4 hover:underline">No thanks</button>
      </div>
    </dialog>
  );
}
