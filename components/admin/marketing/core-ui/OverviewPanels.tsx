import Link from 'next/link';
import { ArrowUpRight, BadgeCheck, CalendarClock, MessageSquareReply, ShieldCheck, Sparkles } from 'lucide-react';
import { nextBestCampaignAction } from '@/app/admin/marketing/campaigns/draft-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import type { CompliancePanel, NeedsYou } from './overview-data';

function QueueItem({ href, icon, label, count, hint }: { href: string; icon: React.ReactNode; label: string; count: number; hint: string }) {
  const hot = count > 0;
  return (
    <li>
      <Link
        href={href}
        className={`group flex items-center gap-3 rounded-sm border px-3 py-3 transition-colors ${hot ? 'border-clover/35 bg-clover/[0.06] hover:border-clover' : 'border-line bg-carbon hover:border-chalk/30'}`}
      >
        <span className={`grid size-9 shrink-0 place-items-center rounded-sm ${hot ? 'bg-clover text-carbon' : 'bg-gunmetal text-steel'}`} aria-hidden="true">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{label}</span>
          <span className="block truncate text-xs text-steel">{hint}</span>
        </span>
        <span className={`display text-3xl not-italic tabular-nums ${hot ? 'text-clover' : 'text-chalk/40'}`}>{count}</span>
        <ArrowUpRight className="size-4 text-steel transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-clover" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function NeedsYouQueue({ needs }: { needs: NeedsYou }) {
  return (
    <ul className="grid gap-2">
      <QueueItem href="/admin/marketing/content" icon={<BadgeCheck className="size-4" />} label="Approvals" count={needs.approvals} hint="Drafts waiting for your OK" />
      <QueueItem href="/admin/marketing/reviews" icon={<MessageSquareReply className="size-4" />} label="Reviews to answer" count={needs.reviews} hint="Reply within a day" />
      <QueueItem href="/admin/marketing/campaigns?status=scheduled" icon={<CalendarClock className="size-4" />} label="Scheduled campaigns" count={needs.scheduled} hint={`${needs.drafts} draft${needs.drafts === 1 ? '' : 's'} not scheduled`} />
    </ul>
  );
}

export function AssistantCard({ summary }: { summary: { text: string; simulated: boolean } | null }) {
  return (
    <section aria-labelledby="assistant-heading" className="relative overflow-hidden rounded-md border border-violet/40 bg-gradient-to-br from-violet/15 via-carbon-2 to-carbon-2 p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-violet/20 blur-3xl" aria-hidden="true" />
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-violet-300">
        <Sparkles className="size-4" aria-hidden="true" /> Assistant
      </p>
      <h2 id="assistant-heading" className="display mt-2 text-2xl not-italic">Last 30 days</h2>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-chalk/80">{summary?.text ?? 'No summary yet. Data fills in as leads arrive.'}</p>
      {summary?.simulated && <p className="mt-2 text-xs font-semibold text-amber-300">Includes simulated demo numbers.</p>}
      <ActionForm action={nextBestCampaignAction} className="mt-4">
        <PendingButton className="w-full sm:w-auto">
          <Sparkles className="size-4" aria-hidden="true" /> Draft next best campaign
        </PendingButton>
      </ActionForm>
    </section>
  );
}

function PulseStat({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warn' | 'good' }) {
  const color = tone === 'warn' && value > 0 ? 'text-amber-300' : tone === 'good' ? 'text-clover' : 'text-chalk';
  return (
    <div className="border-l border-line pl-3">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-widest text-steel">{label}</dt>
      <dd className={`display mt-1 text-3xl not-italic tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}

export function CompliancePulseCard({ pulse }: { pulse: CompliancePanel }) {
  return (
    <section aria-labelledby="pulse-heading" className="rounded-md border border-line bg-carbon-2 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="pulse-heading" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-clover">
          <ShieldCheck className="size-4" aria-hidden="true" /> Compliance pulse
        </h2>
        <Link href="/admin/marketing/settings#suppressions" className="text-xs font-semibold text-steel hover:text-clover">Manage</Link>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
        <PulseStat label="Opt-outs · 30d" value={pulse.optOuts30d} tone="warn" />
        <PulseStat label="Caps hit · 30d" value={pulse.capsHit} tone="warn" />
        <PulseStat label="Quiet-hour holds" value={pulse.quietDeferrals} />
        <PulseStat label="Suppressed" value={pulse.suppressed} />
        <PulseStat label="SMS opted in" value={pulse.smsConsented} tone="good" />
        <PulseStat label="Email subscribed" value={pulse.emailSubscribed} tone="good" />
      </dl>
    </section>
  );
}
