import Link from 'next/link';
import { ChevronLeft, Signal, Wifi } from 'lucide-react';
import { SHOP_TIME_ZONE, dateTime, timeOnly } from '@/lib/format';

export interface PhoneThread {
  number: string;
  name: string;
  messages: { id: string; body: string; created_at: string; status: string; error: string | null; automation: string | null }[];
}

interface DemoPhoneProps {
  threads: PhoneThread[];
  active: PhoneThread | null;
  threadHref: (number: string) => string;
  listHref: string;
}

function clock(): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: SHOP_TIME_ZONE }).format(new Date()).replace(/\s?[AP]M/, '');
}

/** CSS phone mockup: thread list, or one conversation of simulated texts. */
export function DemoPhone({ threads, active, threadHref, listHref }: DemoPhoneProps) {
  return (
    <div className="relative mx-auto w-full max-w-[22rem]">
      <div className="relative aspect-[9/19] w-full rounded-[3.2rem] border border-white/15 bg-[linear-gradient(145deg,#2b302e,#0c0e0d)] p-[0.7rem] shadow-[0_40px_120px_-40px_rgb(31_191_63/0.45),inset_0_0_0_2px_rgb(0_0_0/0.6)]">
        <span className="absolute -left-[3px] top-28 h-12 w-[3px] rounded-l bg-[#2b302e]" aria-hidden="true" />
        <span className="absolute -right-[3px] top-36 h-20 w-[3px] rounded-r bg-[#2b302e]" aria-hidden="true" />
        <div className="relative flex h-full flex-col overflow-hidden rounded-[2.6rem] bg-black">
          <div className="flex items-center justify-between px-7 pb-1 pt-3 text-[0.72rem] font-semibold text-white">
            <span className="tabular-nums">{clock()}</span>
            <span className="absolute left-1/2 top-2.5 h-6 w-24 -translate-x-1/2 rounded-full bg-[#050505]" aria-hidden="true" />
            <span className="flex items-center gap-1" aria-hidden="true"><Signal className="size-3" /><Wifi className="size-3" /><span className="h-2.5 w-5 rounded-[3px] border border-white/60 p-px"><span className="block h-full w-3/4 rounded-[1px] bg-white" /></span></span>
          </div>

          {active ? (
            <>
              <div className="flex items-center gap-2 border-b border-white/10 px-3 pb-2 pt-1">
                <Link href={listHref} scroll={false} className="flex items-center text-[0.8rem] text-sky-400" aria-label="Back to all threads"><ChevronLeft className="size-5" />{threads.length}</Link>
                <div className="flex-1 text-center">
                  <span className="mx-auto grid size-9 place-items-center rounded-full bg-gradient-to-b from-[#9aa3a0] to-[#6b7370] text-sm font-bold text-white">{active.name.slice(0, 1).toUpperCase()}</span>
                  <p className="mt-0.5 truncate text-[0.7rem] text-white">{active.name}</p>
                </div>
                <span className="w-8" />
              </div>
              <p className="bg-violet/25 px-3 py-1 text-center text-[0.6rem] font-semibold text-violet-200">Simulated — goes live after carrier registration</p>
              <ol className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-3">
                {active.messages.map((m, i) => {
                  const prev = active.messages[i - 1];
                  const gap = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 30 * 60_000;
                  return (
                    <li key={m.id} className="flex flex-col items-start">
                      {gap && <p className="w-full py-1 text-center text-[0.6rem] text-white/45">{dateTime(m.created_at)}</p>}
                      <p className={`max-w-[82%] whitespace-pre-wrap break-words rounded-[1.1rem] rounded-bl-[0.35rem] px-3 py-1.5 text-[0.78rem] leading-snug ${m.status === 'skipped' ? 'border border-dashed border-amber-300/50 bg-transparent text-white/50' : 'bg-[#26292a] text-white'}`}>
                        {m.body}
                      </p>
                      <p className="mt-0.5 pl-1 text-[0.55rem] text-white/40">
                        {timeOnly(m.created_at)}{m.status === 'skipped' ? ` · not sent: ${m.error ?? 'skipped'}` : m.automation ? ` · ${m.automation}` : ''}
                      </p>
                    </li>
                  );
                })}
              </ol>
              <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5" aria-hidden="true">
                <span className="flex-1 rounded-full border border-white/15 px-3 py-1.5 text-[0.7rem] text-white/35">Text Message</span>
              </div>
            </>
          ) : (
            <>
              <p className="px-5 pb-2 pt-3 text-2xl font-bold text-white">Messages</p>
              <ul className="flex-1 overflow-y-auto">
                {threads.length === 0 && <li className="px-5 py-10 text-center text-xs text-white/45">No texts yet. Trigger an automation and it lands here.</li>}
                {threads.map((t) => {
                  const last = t.messages[t.messages.length - 1];
                  return (
                    <li key={t.number}>
                      <Link href={threadHref(t.number)} scroll={false} className="flex gap-3 border-b border-white/10 px-4 py-2.5 hover:bg-white/5">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#9aa3a0] to-[#6b7370] text-sm font-bold text-white">{t.name.slice(0, 1).toUpperCase()}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[0.8rem] font-semibold text-white">{t.name}</span>
                            <span className="shrink-0 text-[0.6rem] text-white/45">{last ? timeOnly(last.created_at) : ''}</span>
                          </span>
                          <span className="line-clamp-2 text-[0.7rem] leading-snug text-white/55">{last?.body}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <span className="mx-auto mb-2 mt-1 h-1 w-28 rounded-full bg-white/70" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
