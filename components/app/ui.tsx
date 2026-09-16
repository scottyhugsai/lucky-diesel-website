import Link from 'next/link';
import type { Enums } from '@/lib/db/database.types';
import { WORK_ORDER_STATUS } from '@/lib/format';

/* Shared building blocks for the client, employee and admin apps. Server-safe (no hooks). */

type Tone = 'neutral' | 'info' | 'warn' | 'good' | 'bad' | 'violet';

const TONES: Record<Tone, string> = {
  neutral: 'border-line bg-gunmetal text-chalk/80',
  info: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  warn: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  good: 'border-clover/35 bg-clover/10 text-clover',
  bad: 'border-danger/35 bg-danger/10 text-danger',
  violet: 'border-violet/40 bg-violet/15 text-violet-300',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-semibold ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusPill({ status, customer = false }: { status: Enums<'work_order_status'>; customer?: boolean }) {
  const meta = WORK_ORDER_STATUS[status];
  return (
    <Badge tone={meta.tone}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {customer ? meta.customerLabel : meta.label}
    </Badge>
  );
}

export function PageHeader({ kicker, title, description, actions }: { kicker?: string; title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6 sm:pb-8">
      <div className="min-w-0">
        {kicker && <p className="kicker">{kicker}</p>}
        <h1 className="display mt-2 text-4xl sm:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-chalk/65">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, action, children, className = '', padded = true }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={`rounded-md border border-line bg-carbon-2 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          {title && <h2 className="display text-xl not-italic">{title}</h2>}
          {action}
        </div>
      )}
      <div className={padded ? 'p-4 sm:p-5' : ''}>{children}</div>
    </section>
  );
}

export function StatTile({ label, value, hint, tone = 'neutral' }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' }) {
  const accent = tone === 'good' ? 'text-clover' : tone === 'warn' ? 'text-amber-300' : 'text-chalk';
  return (
    <div className="rounded-md border border-line bg-carbon-2 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-steel">{label}</p>
      <p className={`display mt-2 text-4xl not-italic tabular-nums ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-sm text-chalk/55">{hint}</p>}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function buttonClass(variant: ButtonVariant = 'primary', size: 'sm' | 'md' = 'md'): string {
  const sizing = size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-4 text-[0.95rem]';
  const look: Record<ButtonVariant, string> = {
    primary: 'btn-go font-bold',
    secondary: 'border border-chalk/20 bg-carbon font-semibold text-chalk hover:border-clover hover:text-clover',
    ghost: 'font-semibold text-chalk/75 hover:bg-gunmetal hover:text-chalk',
    danger: 'border border-danger/40 font-semibold text-danger hover:bg-danger/10',
  };
  return `inline-flex items-center justify-center gap-2 rounded-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${look[variant]}`;
}

export function ButtonLink({ href, variant = 'primary', size = 'md', children, className = '' }: { href: string; variant?: ButtonVariant; size?: 'sm' | 'md'; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={`${buttonClass(variant, size)} ${className}`}>
      {children}
    </Link>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line px-6 py-12 text-center">
      <p className="display text-2xl not-italic">{title}</p>
      {children && <p className="max-w-sm text-sm text-chalk/60">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color?: string | null; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join('') || '?';
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-bold text-carbon"
      style={{ width: size, height: size, background: color ?? 'var(--clover)', fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/** Wraps a table so it scrolls sideways on phones instead of breaking the page. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 overflow-x-auto sm:mx-0">{children}</div>;
}

export const tableClass = 'w-full min-w-[640px] text-left text-sm [&_th]:border-b [&_th]:border-line [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-widest [&_th]:text-steel [&_td]:border-b [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_tr:last-child_td]:border-b-0';

export const fieldClass =
  'h-11 w-full rounded-sm border border-line bg-carbon px-3 text-[0.95rem] text-chalk placeholder:text-steel/60 transition-colors focus:border-clover focus:outline-none focus:ring-2 focus:ring-clover/30';

export const labelClass = 'mb-1.5 block text-sm font-semibold text-chalk/85';
