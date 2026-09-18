'use client';

import { MessageSquare, Phone, Send, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SMS_CONSENT_TEXT } from '@/lib/lead';
import { BUSINESS } from '@/lib/site';
import type { ChatThreadView } from '@/lib/marketing/engage/chat';
import { trackEvent } from './analytics';

const POLL_MS = 8_000;
const inputClass = 'h-11 w-full rounded-sm border border-line bg-carbon px-3 text-[0.95rem] text-chalk placeholder:text-steel/70 focus:border-clover focus:outline-none focus:ring-2 focus:ring-clover/30 [[data-design=v2]_&]:rounded-lg';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'error'; message: string };

async function post(body: unknown): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('/api/marketing/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  return { ok: response.ok && data.ok !== false, error: data.error };
}

/**
 * Web chat: a real thread the shop answers from the admin. The visitor's thread
 * is found only by an httpOnly cookie, so nothing identifies them in the page.
 */
export function ChatPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const [thread, setThread] = useState<ChatThreadView | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/marketing/chat', { credentials: 'same-origin', cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as { thread?: ChatThreadView | null };
      setThread(data.thread ?? null);
    } catch {
      // Offline: keep whatever is on screen.
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    // First fetch runs on a task, not during the effect, so no cascading render.
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), POLL_MS);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(first); window.clearInterval(timer); document.removeEventListener('keydown', onKey); };
  }, [isOpen, load, onClose]);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [thread]);

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const get = (key: string) => String(data.get(key) ?? '').trim();
    setStatus({ kind: 'sending' });
    const result = await post({
      action: 'start', name: get('name'), phone: get('phone'), email: get('email'), message: get('message'),
      smsConsent: data.get('sms') === 'on', pageUrl: window.location.href, company: get('company'),
    }).catch(() => ({ ok: false, error: 'No connection. Call or text instead.' }));
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.error ?? 'That didn’t send.' });
      return;
    }
    form.reset();
    setStatus({ kind: 'idle' });
    trackEvent('chat_start');
    await load();
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = String(new FormData(form).get('message') ?? '').trim();
    if (!message) return;
    setStatus({ kind: 'sending' });
    const result = await post({ action: 'send', message }).catch(() => ({ ok: false, error: 'No connection.' }));
    setStatus(result.ok ? { kind: 'idle' } : { kind: 'error', message: result.error ?? 'Couldn’t send.' });
    if (result.ok) { form.reset(); await load(); }
  }

  return (
    <div
      ref={panelRef}
      id="text-us-panel"
      role="dialog"
      aria-label="Chat with Lucky Diesel"
      hidden={!isOpen}
      className="absolute bottom-14 right-0 w-[min(22rem,calc(100vw-1.5rem))] rounded-md border border-line bg-carbon-2 p-4 shadow-2xl [[data-design=v2]_&]:rounded-2xl"
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

      {!isLoaded ? (
        <p className="mt-4 border-t border-line pt-4 text-sm text-steel">Loading…</p>
      ) : thread ? (
        <div className="mt-4 grid gap-2 border-t border-line pt-4">
          <div ref={feedRef} className="grid max-h-56 gap-2 overflow-y-auto pr-1" aria-live="polite" aria-label="Messages">
            {thread.messages.map((message) => (
              <p
                key={message.id}
                className={`max-w-[85%] rounded-sm px-2.5 py-1.5 text-sm ${message.sender === 'visitor' ? 'justify-self-end bg-clover/15 text-chalk' : 'justify-self-start bg-gunmetal text-chalk/90'}`}
              >
                {message.body}
              </p>
            ))}
          </div>
          <form onSubmit={send} className="flex gap-2" aria-label="Send a message">
            <label className="sr-only" htmlFor="cp-reply">Message</label>
            <input id="cp-reply" name="message" required maxLength={1000} placeholder="Type a message" className={inputClass} />
            <button type="submit" disabled={status.kind === 'sending'} aria-label="Send" className="btn-go grid size-11 shrink-0 place-items-center rounded-sm disabled:opacity-60 [[data-design=v2]_&]:rounded-lg">
              <Send className="size-4" aria-hidden="true" />
            </button>
          </form>
          {status.kind === 'error' && <p role="alert" className="text-sm text-danger">{status.message}</p>}
        </div>
      ) : (
        <form onSubmit={start} className="mt-4 grid gap-2 border-t border-line pt-4" aria-label="Start a chat">
          <p className="text-sm text-chalk/70">Or chat with us here.</p>
          <label className="sr-only" htmlFor="cp-name">Name</label>
          <input id="cp-name" name="name" required minLength={2} autoComplete="name" placeholder="Name" className={inputClass} />
          <div className="grid grid-cols-2 gap-2">
            <label className="sr-only" htmlFor="cp-phone">Phone</label>
            <input id="cp-phone" name="phone" type="tel" autoComplete="tel" placeholder="Phone" className={inputClass} />
            <label className="sr-only" htmlFor="cp-email">Email</label>
            <input id="cp-email" name="email" type="email" autoComplete="email" placeholder="Email" className={inputClass} />
          </div>
          <label className="sr-only" htmlFor="cp-message">Message</label>
          <textarea id="cp-message" name="message" rows={2} required maxLength={1000} placeholder="What’s the truck doing?" className={`${inputClass} h-auto py-2`} />
          <input name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
          <label className="flex items-start gap-2 text-[0.7rem] leading-snug text-steel">
            <input type="checkbox" name="sms" className="mt-0.5 size-4 shrink-0 accent-clover" />
            <span>{SMS_CONSENT_TEXT}</span>
          </label>
          {status.kind === 'error' && <p role="alert" className="text-sm text-danger">{status.message}</p>}
          <button type="submit" disabled={status.kind === 'sending'} className="btn-go h-11 rounded-sm text-sm font-bold disabled:opacity-60 [[data-design=v2]_&]:rounded-lg">
            {status.kind === 'sending' ? 'Starting…' : 'Start chat'}
          </button>
        </form>
      )}
    </div>
  );
}
