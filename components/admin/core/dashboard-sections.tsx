import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Clock, Package, Receipt, TimerOff, Truck } from 'lucide-react';
import { Avatar, EmptyState } from '@/components/app/ui';
import { WORK_ORDER_STATUS, money, relativeTime } from '@/lib/format';
import type { AttentionItem, DashboardData } from './dashboard-data';
import type { Kpi } from './metrics';

export function compactMoney(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) return `$${(dollars / 1000).toFixed(dollars >= 10_000 ? 0 : 1)}k`;
  return `$${Math.round(dollars)}`;
}

export function TodayStrip({ today }: { today: DashboardData['today'] }) {
  const cells = [
    { href: '/admin/calendar', label: 'Appointments today', value: String(today.appointments), icon: CalendarDays, hot: false },
    { href: '/admin/jobs', label: 'Trucks in the shop', value: String(today.inShop), icon: Truck, hot: false },
    { href: '/admin/jobs?view=list&status=awaiting_approval', label: 'Awaiting approval', value: String(today.awaitingApproval), icon: Clock, hot: today.awaitingApproval > 0 },
    { href: '/admin/invoices?tab=open', label: `Unpaid · ${today.unpaidCount} invoice${today.unpaidCount === 1 ? '' : 's'}`, value: money(today.unpaidCents, { whole: true }), icon: Receipt, hot: today.unpaidCents > 0 },
  ];
  return (
    <nav aria-label="Today" className="grid grid-cols-2 overflow-hidden rounded-md border border-line bg-line gap-px lg:grid-cols-4">
      {cells.map(({ href, label, value, icon: Icon, hot }) => (
        <Link key={href} href={href} className="group relative flex min-w-0 flex-col justify-between gap-5 bg-carbon-2 p-4 transition-colors hover:bg-gunmetal focus-visible:z-10 sm:p-5">
          <span className="flex items-start justify-between gap-2 text-xs font-semibold uppercase leading-snug tracking-widest text-steel">
            <span className="min-w-0">{label}</span>
            <Icon className={`size-4 shrink-0 ${hot ? 'text-clover' : ''}`} aria-hidden="true" />
          </span>
          <span className="flex items-end justify-between gap-2">
            <span className={`display truncate text-4xl not-italic tabular-nums sm:text-5xl ${hot ? 'text-clover' : 'text-chalk'}`}>{value}</span>
            <ArrowRight className="mb-1 size-4 shrink-0 text-steel opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />
          </span>
          {hot && <span className="absolute inset-y-0 left-0 w-0.5 bg-clover" aria-hidden="true" />}
        </Link>
      ))}
    </nav>
  );
}

function formatKpi(kpi: Kpi, value: number | null): string {
  if (value === null) return '—';
  if (kpi.format === 'money') return money(value, { whole: true });
  if (kpi.format === 'percent') return `${Math.round(value * 100)}%`;
  return String(value);
}

function delta(kpi: Kpi): { text: string; direction: 'up' | 'down' | 'flat' } | null {
  if (kpi.current === null || kpi.previous === null) return null;
  if (kpi.format === 'percent') {
    const points = Math.round((kpi.current - kpi.previous) * 1000) / 10;
    return { text: `${points > 0 ? '+' : ''}${points} pts`, direction: points > 0 ? 'up' : points < 0 ? 'down' : 'flat' };
  }
  if (kpi.previous === 0) return kpi.current === 0 ? { text: 'no change', direction: 'flat' } : { text: 'new', direction: 'up' };
  const pct = Math.round(((kpi.current - kpi.previous) / kpi.previous) * 100);
  return { text: `${pct > 0 ? '+' : ''}${pct}%`, direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}

export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => {
        const change = delta(kpi);
        const Arrow = change?.direction === 'down' ? ArrowDownRight : ArrowUpRight;
        return (
          <div key={kpi.key} className="flex min-w-0 flex-col bg-carbon-2 p-4">
            <dt className="text-xs font-semibold uppercase tracking-widest text-steel">{kpi.label}</dt>
            <dd className="display mt-3 text-[2.1rem] not-italic tabular-nums leading-none">{formatKpi(kpi, kpi.current)}</dd>
            <dd className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              {change ? (
                <span className={`inline-flex items-center gap-0.5 font-bold ${change.direction === 'up' ? 'text-clover' : change.direction === 'down' ? 'text-danger' : 'text-steel'}`}>
                  {change.direction !== 'flat' && <Arrow className="size-3.5" aria-hidden="true" />}
                  {change.text}
                </span>
              ) : (
                <span className="font-bold text-steel">no prior data</span>
              )}
              <span className="text-steel">vs {formatKpi(kpi, kpi.previous)}</span>
            </dd>
            <dd className="mt-auto pt-3 text-[0.72rem] leading-snug text-chalk/45">{kpi.hint}</dd>
          </div>
        );
      })}
    </dl>
  );
}

const ATTENTION_META: Record<AttentionItem['kind'], { icon: typeof TimerOff; tone: string; label: string }> = {
  overdue: { icon: TimerOff, tone: 'text-danger', label: 'Overdue' },
  estimate: { icon: Clock, tone: 'text-amber-300', label: 'Waiting' },
  parts: { icon: Package, tone: 'text-sky-300', label: 'Parts' },
};

export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (!items.length) return <EmptyState title="All clear">No late jobs, stale estimates or open part requests.</EmptyState>;
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const meta = ATTENTION_META[item.kind];
        const Icon = meta.icon;
        return (
          <li key={item.id}>
            <Link href={item.href} className="group -mx-2 flex items-start gap-3 rounded-sm px-2 py-3 hover:bg-gunmetal">
              <Icon className={`mt-0.5 size-5 shrink-0 ${meta.tone}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{item.title}</span>
                <span className="block truncate text-sm text-chalk/60">{item.detail}</span>
              </span>
              <span className="shrink-0 text-right text-xs">
                <span className={`block font-bold uppercase tracking-wider ${meta.tone}`}>{meta.label}</span>
                <span className="block text-steel">{relativeTime(item.since)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ActivityFeed({ events }: { events: DashboardData['events'] }) {
  if (!events.length) return <EmptyState title="Quiet so far">Status changes will show up here.</EmptyState>;
  return (
    <ol className="space-y-4">
      {events.map((event) => {
        const actor = event.profiles?.full_name ?? 'System';
        const wo = event.work_orders;
        return (
          <li key={event.id} className="flex gap-3">
            <Avatar name={actor} color={event.profiles ? event.profiles.avatar_color : 'var(--steel)'} size={30} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="leading-snug">
                <span className="font-semibold">{actor}</span>{' '}
                <span className="text-chalk/60">{event.from_status ? 'moved' : 'opened'}</span>{' '}
                {wo ? (
                  <Link href={`/admin/jobs/${wo.id}`} className="font-semibold text-chalk underline decoration-line underline-offset-2 hover:text-clover">
                    WO #{wo.number}
                  </Link>
                ) : (
                  'a job'
                )}{' '}
                <span className="text-chalk/60">{event.from_status ? 'to' : 'as'}</span> <span className="font-semibold text-clover">{WORK_ORDER_STATUS[event.to_status].label}</span>
              </p>
              <p className="mt-0.5 truncate text-xs text-steel">
                {wo?.customers?.full_name ? `${wo.customers.full_name} · ` : ''}
                {relativeTime(event.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
