'use client';

import Link from 'next/link';
import { LoaderCircle, SendHorizontal, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { buttonClass, fieldClass } from '@/components/app/ui';

interface Answer {
  text: string;
  generator: 'demo' | 'ai';
  includesSimulatedData: boolean;
  links: { href: string; label: string }[];
  note: string | null;
  compliance: { status: 'pass' | 'warn' | 'block' };
}

interface Turn {
  id: number;
  question: string;
  answer: Answer | null;
  error: string | null;
}

const MAX = 300;

export function CopilotChat({ suggestions }: { suggestions: readonly string[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLLIElement>(null);

  async function ask(question: string) {
    const trimmed = question.trim().slice(0, MAX);
    if (!trimmed || busy) return;
    const id = nextId.current++;
    setTurns((prev) => [...prev, { id, question: trimmed, answer: null, error: null }]);
    setDraft('');
    setBusy(true);
    try {
      const response = await fetch('/api/marketing/content/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', message: trimmed }),
      });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; data?: Answer; error?: string } | null;
      const update: Partial<Turn> = json?.ok && json.data ? { answer: json.data } : { error: json?.error ?? 'The copilot is unavailable right now.' };
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...update } : t)));
    } catch {
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, error: 'Network error. Try again.' } : t)));
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
  }

  return (
    <div className="grid gap-4">
      <ul className="grid gap-4" aria-live="polite">
        {turns.length === 0 && (
          <li className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-chalk/60">
            Ask about leads, ads, reviews, sends or opt-outs. Answers come from your data.
          </li>
        )}
        {turns.map((turn) => (
          <li key={turn.id} className="grid gap-2">
            <p className="max-w-[85%] justify-self-end rounded-md bg-gunmetal px-3 py-2 text-sm">{turn.question}</p>
            <div className="max-w-[92%] rounded-md border border-violet/35 bg-violet/[0.07] px-3 py-2.5 text-sm">
              {!turn.answer && !turn.error && <span className="inline-flex items-center gap-2 text-chalk/60"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Checking your data…</span>}
              {turn.error && <p role="alert" className="text-danger">{turn.error}</p>}
              {turn.answer && (
                <>
                  <p className="leading-relaxed text-chalk/90">{turn.answer.text}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-steel">
                    <span className="inline-flex items-center gap-1"><Sparkles className="size-3.5 text-violet-300" aria-hidden="true" />{turn.answer.generator === 'ai' ? 'AI, from your data' : 'From your data'}</span>
                    {turn.answer.includesSimulatedData && <span className="font-semibold text-amber-300">Includes simulated numbers</span>}
                    {turn.answer.links.map((l) => <Link key={l.href} href={l.href} className="font-semibold text-clover hover:underline">{l.label}</Link>)}
                  </p>
                  {turn.answer.note && <p className="mt-1 text-xs text-amber-300">{turn.answer.note}</p>}
                </>
              )}
            </div>
          </li>
        ))}
        <li ref={endRef} aria-hidden="true" />
      </ul>

      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button key={s} type="button" disabled={busy} onClick={() => ask(s)} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-chalk/75 transition-colors hover:border-clover hover:text-clover disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void ask(draft); }} className="flex gap-2">
        <label htmlFor="copilot-q" className="sr-only">Ask the copilot</label>
        <input id="copilot-q" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX} placeholder="How many leads this week?" className={fieldClass} autoComplete="off" />
        <button type="submit" disabled={busy || !draft.trim()} className={buttonClass('primary')} aria-label="Ask">
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="size-4" aria-hidden="true" />}
        </button>
      </form>
    </div>
  );
}
