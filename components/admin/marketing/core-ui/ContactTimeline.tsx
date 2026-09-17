import { CircleDollarSign, Globe, Mail, Megaphone, ShieldCheck } from 'lucide-react';
import { dateTime } from '@/lib/format';
import type { TimelineEntry, TimelineKind } from './contact-detail-data';

const ICONS: Record<TimelineKind, typeof Globe> = { touch: Globe, message: Mail, campaign: Megaphone, conversion: CircleDollarSign, consent: ShieldCheck };
const KIND_LABEL: Record<TimelineKind, string> = { touch: 'Visit', message: 'Message', campaign: 'Campaign', conversion: 'Conversion', consent: 'Consent' };
const DOT: Record<TimelineEntry['tone'], string> = {
  neutral: 'border-line bg-gunmetal text-chalk/70', info: 'border-sky-400/40 bg-sky-400/10 text-sky-300', good: 'border-clover/50 bg-clover/15 text-clover',
  warn: 'border-amber-400/40 bg-amber-400/10 text-amber-300', bad: 'border-danger/45 bg-danger/10 text-danger',
};

export function ContactTimeline({ entries, filter }: { entries: TimelineEntry[]; filter: TimelineKind | null }) {
  const shown = filter ? entries.filter((e) => e.kind === filter) : entries;
  if (!shown.length) return <p className="py-8 text-center text-sm text-steel">Nothing here yet.</p>;
  return (
    <ol className="relative ml-4 border-l border-line">
      {shown.slice(0, 80).map((entry) => {
        const Icon = ICONS[entry.kind];
        return (
          <li key={entry.id} className="relative pb-5 pl-6 last:pb-0">
            <span className={`absolute -left-4 top-0 grid size-8 place-items-center rounded-full border ${DOT[entry.tone]}`} aria-hidden="true">
              <Icon className="size-3.5" />
            </span>
            <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-steel">
              {KIND_LABEL[entry.kind]} · <time dateTime={entry.at}>{dateTime(entry.at)}</time>
            </p>
            <p className="mt-0.5 font-semibold leading-snug">{entry.title}</p>
            {entry.detail && <p className="mt-0.5 break-words text-sm text-chalk/60">{entry.detail}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export const TIMELINE_FILTERS: { value: TimelineKind | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'message', label: 'Messages' },
  { value: 'campaign', label: 'Campaigns' },
  { value: 'conversion', label: 'Conversions' },
  { value: 'touch', label: 'Visits' },
  { value: 'consent', label: 'Consent' },
];
