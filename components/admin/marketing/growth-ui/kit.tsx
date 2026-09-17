import Link from 'next/link';
import { Star } from 'lucide-react';
import { labelClass } from '@/components/app/ui';

/* Small server-safe building blocks shared by Reviews, Growth and Pages. */

export interface TabItem {
  key: string;
  label: string;
  href: string;
  count?: number;
}

/** Underlined tab row that scrolls sideways on phones. */
export function SubTabs({ items, active, label }: { items: readonly TabItem[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {items.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={`-mb-px flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors ${isActive ? 'border-clover text-chalk' : 'border-transparent text-chalk/60 hover:text-chalk'}`}
              >
                {tab.label}
                {tab.count !== undefined && <span className="rounded-sm bg-gunmetal px-1.5 text-xs tabular-nums text-chalk/70">{tab.count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Field({ label, htmlFor, hint, children, className = '' }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelClass}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-steel">{hint}</p>}
    </div>
  );
}

export const areaClass =
  'w-full rounded-sm border border-line bg-carbon px-3 py-2.5 text-[0.95rem] text-chalk placeholder:text-steel/60 focus:border-clover focus:outline-none focus:ring-2 focus:ring-clover/30';

export function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'size-5' : 'size-4';
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden="true" className={`${cls} ${n <= rating ? 'fill-amber-300 text-amber-300' : 'text-steel/40'}`} />
      ))}
    </span>
  );
}

/** Label/value pair for compact stat rows inside cards. */
export function Metric({ label, value, tone = 'neutral' }: { label: string; value: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const color = tone === 'good' ? 'text-clover' : tone === 'warn' ? 'text-amber-300' : tone === 'bad' ? 'text-danger' : 'text-chalk';
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-steel">{label}</p>
      <p className={`mt-1 font-mono text-2xl tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

export function SampleTag() {
  return <span className="rounded-sm border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-amber-300">Sample</span>;
}

/** "2026-10-17T14:00:00Z" → "Oct 17, 10:00 AM" in shop time. */
export function shortDate(iso: string | null, withTime = false): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', timeZone: 'America/New_York', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(iso));
}
