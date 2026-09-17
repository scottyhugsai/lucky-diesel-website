import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buttonClass } from '@/components/app/ui';
import { timeOnly } from '@/lib/format';
import { SOCIAL_LABEL, statusLabel } from './labels';
import type { CalendarPost } from './social-data';
import type { SocialPlatform } from '@/lib/marketing/content/types';

const TARGET_DOT: Record<string, string> = {
  published: 'bg-clover', simulated: 'bg-clover', draft_handoff: 'bg-sky-300', scheduled: 'bg-violet', failed: 'bg-danger', pending: 'bg-steel',
};

const STATUS_EDGE: Record<string, string> = {
  pending_approval: 'border-l-amber-300', approved: 'border-l-sky-300', scheduled: 'border-l-violet', published: 'border-l-clover', failed: 'border-l-danger', rejected: 'border-l-danger', draft: 'border-l-steel',
};

function weekdayLabel(date: string, style: 'short' | 'long' = 'short'): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: style, month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function PostChip({ post, compact = false }: { post: CalendarPost; compact?: boolean }) {
  return (
    <Link
      href={`/admin/marketing/social/${post.id}`}
      className={`block rounded-sm border border-l-4 border-line bg-carbon px-2 py-1.5 text-left transition-colors hover:border-chalk/30 ${STATUS_EDGE[post.status] ?? 'border-l-steel'}`}
    >
      <span className="block truncate text-sm font-semibold">{post.title}</span>
      {!compact && (
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-chalk/60">
          {post.scheduledFor && <span>{timeOnly(post.scheduledFor)}</span>}
          <span>{statusLabel(post.status)}</span>
          {post.needsPrivacyReview && <span className="text-amber-300">Check photo</span>}
        </span>
      )}
      {!compact && (
        <span className="mt-1 flex flex-wrap gap-1">
          {post.targets.map((t) => (
            <span key={t.platform} className="inline-flex items-center gap-1 rounded-sm bg-gunmetal px-1.5 py-0.5 text-[0.7rem] font-semibold" title={`${t.platform}: ${statusLabel(t.status)}`}>
              <span className={`size-1.5 rounded-full ${TARGET_DOT[t.status] ?? 'bg-steel'}`} aria-hidden="true" />
              {SOCIAL_LABEL[t.platform as SocialPlatform] ?? t.platform}
              <span className="sr-only">{statusLabel(t.status)}</span>
            </span>
          ))}
        </span>
      )}
    </Link>
  );
}

export function CalendarNav({ view, date, start, prev, next, today }: { view: 'week' | 'month'; date: string; start: string; prev: string; next: string; today: string }) {
  const href = (v: string, d: string) => `/admin/marketing/social?view=${v}&d=${d}`;
  const title = view === 'week' ? `Week of ${weekdayLabel(start)}` : new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <Link href={href(view, prev)} className={buttonClass('ghost', 'sm')} aria-label={`Previous ${view}`}><ChevronLeft className="size-4" aria-hidden="true" /></Link>
        <Link href={href(view, today)} className={buttonClass('secondary', 'sm')}>Today</Link>
        <Link href={href(view, next)} className={buttonClass('ghost', 'sm')} aria-label={`Next ${view}`}><ChevronRight className="size-4" aria-hidden="true" /></Link>
        <h2 className="display ml-2 text-2xl not-italic">{title}</h2>
      </div>
      <div className="flex rounded-sm border border-line p-0.5" role="group" aria-label="View">
        {(['week', 'month'] as const).map((v) => (
          <Link key={v} href={href(v, date)} aria-current={v === view ? 'true' : undefined} className={`rounded-sm px-3 py-1.5 text-sm font-semibold capitalize ${v === view ? 'bg-clover text-carbon' : 'text-chalk/70 hover:text-chalk'}`}>{v}</Link>
        ))}
      </div>
    </div>
  );
}

export function WeekView({ days, posts, today }: { days: readonly string[]; posts: readonly CalendarPost[]; today: string }) {
  return (
    <ol className="grid gap-2 lg:grid-cols-7">
      {days.map((day) => {
        const items = posts.filter((p) => p.day === day);
        return (
          <li key={day} className={`min-w-0 rounded-md border bg-carbon-2 p-2 lg:min-h-48 ${day === today ? 'border-clover/60' : 'border-line'}`}>
            <p className={`mb-2 text-xs font-bold uppercase tracking-widest ${day === today ? 'text-clover' : 'text-steel'}`}>{weekdayLabel(day)}</p>
            {items.length ? <div className="grid gap-1.5">{items.map((p) => <PostChip key={p.id} post={p} />)}</div> : <p className="text-xs text-chalk/35">No posts</p>}
          </li>
        );
      })}
    </ol>
  );
}

export function MonthView({ days, month, posts, today }: { days: readonly string[]; month: string; posts: readonly CalendarPost[]; today: string }) {
  const inMonth = posts.filter((p) => p.day?.startsWith(month));
  return (
    <>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Month">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <p key={d} role="columnheader" className="pb-1 text-center text-xs font-bold uppercase tracking-widest text-steel">{d}</p>)}
        {days.map((day) => {
          const items = posts.filter((p) => p.day === day);
          const outside = !day.startsWith(month);
          return (
            <div key={day} role="gridcell" className={`min-h-14 min-w-0 rounded-sm border p-1 sm:min-h-28 ${day === today ? 'border-clover/60' : 'border-line'} ${outside ? 'opacity-40' : 'bg-carbon-2'}`}>
              <p className={`text-xs font-semibold ${day === today ? 'text-clover' : 'text-chalk/60'}`}>{Number(day.slice(8))}</p>
              {items.length > 0 && <p className="mt-1 text-center text-xs font-bold text-clover sm:hidden">{items.length}</p>}
              <div className="mt-1 hidden gap-1 sm:grid">
                {items.slice(0, 3).map((p) => <PostChip key={p.id} post={p} compact />)}
                {items.length > 3 && <p className="text-xs text-chalk/55">+{items.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
      <ol className="mt-4 grid gap-2 sm:hidden" aria-label="Posts this month">
        {inMonth.map((p) => <li key={p.id}><p className="mb-1 text-xs text-steel">{p.day && weekdayLabel(p.day)}</p><PostChip post={p} /></li>)}
      </ol>
    </>
  );
}
