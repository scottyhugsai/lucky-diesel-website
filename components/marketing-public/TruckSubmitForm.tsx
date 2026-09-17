'use client';

import { Camera, Check, LoaderCircle } from 'lucide-react';
import { useState } from 'react';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; message: string } | { kind: 'error'; message: string };

const inputClass = 'h-11 w-full rounded-sm border border-line bg-carbon px-3 text-[0.95rem] text-chalk placeholder:text-steel/70 focus:border-clover focus:outline-none focus:ring-2 focus:ring-clover/30 [[data-design=v2]_&]:rounded-lg';

/** "Send us your truck": one photo, their words, and the rights they confirm. Nothing posts without the owner's review. */
export function TruckSubmitForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus({ kind: 'sending' });
    try {
      const response = await fetch('/api/marketing/ugc', { method: 'POST', body: new FormData(form) });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setStatus({ kind: 'error', message: data.message ?? 'That didn’t go through.' });
        return;
      }
      form.reset();
      setStatus({ kind: 'sent', message: data.message ?? 'Got it.' });
    } catch {
      setStatus({ kind: 'error', message: 'Network trouble. Try again.' });
    }
  }

  if (status.kind === 'sent') {
    return (
      <p role="status" className="flex items-center gap-2 text-chalk/80">
        <Check className="size-5 text-clover" aria-hidden="true" /> {status.message}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" aria-describedby="ugc-note">
      <label className="sr-only" htmlFor="ugc-name">Name</label>
      <input id="ugc-name" name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="Name" className={inputClass} />
      <label className="sr-only" htmlFor="ugc-email">Email</label>
      <input id="ugc-email" name="email" type="email" required maxLength={200} autoComplete="email" placeholder="Email" className={inputClass} />
      <label className="sr-only" htmlFor="ugc-truck">Truck</label>
      <input id="ugc-truck" name="truck" maxLength={80} placeholder="Truck (2019 Ram 2500)" className={inputClass} />
      <label className="sr-only" htmlFor="ugc-handle">Instagram handle</label>
      <input id="ugc-handle" name="handle" maxLength={60} placeholder="@handle (optional)" className={inputClass} />
      <label className="sr-only" htmlFor="ugc-caption">What’s the story?</label>
      <textarea id="ugc-caption" name="caption" rows={2} maxLength={500} placeholder="What’s the story?" className={`${inputClass} h-auto py-2 sm:col-span-2`} />
      <label className="sm:col-span-2">
        <span className="mb-1.5 block text-sm font-semibold text-chalk/85">Photo (JPEG or PNG, 8 MB max)</span>
        <input name="photo" type="file" accept="image/jpeg,image/png" required className="block w-full text-sm text-chalk/80 file:mr-3 file:rounded-sm file:border-0 file:bg-clover file:px-3 file:py-2 file:text-sm file:font-bold file:text-carbon" />
      </label>
      <label className="flex items-start gap-2 text-sm text-chalk/75 sm:col-span-2">
        <input name="rights" type="checkbox" required className="mt-0.5 size-4 accent-[var(--clover)]" />
        <span>It’s my photo and Lucky Diesel may post it.</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-chalk/75 sm:col-span-2">
        <input name="credit" type="checkbox" className="mt-0.5 size-4 accent-[var(--clover)]" />
        <span>Credit me by name or handle.</span>
      </label>
      <p id="ugc-note" className="text-xs text-steel sm:col-span-2">
        We check every photo before it goes up, and we never post plates or faces without asking.
      </p>
      {status.kind === 'error' && <p role="alert" className="text-sm font-semibold text-danger sm:col-span-2">{status.message}</p>}
      <button
        type="submit"
        disabled={status.kind === 'sending'}
        className="btn-go inline-flex h-12 items-center justify-center gap-2 rounded-sm px-5 font-bold disabled:opacity-70 sm:col-span-2 sm:justify-self-start [[data-design=v2]_&]:rounded-full"
      >
        {status.kind === 'sending' ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Camera className="size-4" aria-hidden="true" />}
        Send your truck
      </button>
    </form>
  );
}
