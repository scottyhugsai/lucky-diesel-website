import Link from 'next/link';
import { Mail, MessageSquare, Search, TriangleAlert, Truck } from 'lucide-react';
import { Badge, buttonClass, fieldClass } from '@/components/app/ui';
import { money, relativeTime } from '@/lib/format';
import type { ContactFilters, ContactRow } from './contacts-data';
import { STAGE_LABEL, STAGE_TONE, sourceLabel } from './labels';

export function ConsentDots({ sms, email }: { sms: ContactRow['sms']; email: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span title={sms === 'yes' ? 'SMS marketing OK' : sms === 'out' ? 'Opted out of texts' : 'No SMS consent'}
        className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[0.68rem] font-bold ${sms === 'yes' ? 'border-clover/40 text-clover' : sms === 'out' ? 'border-danger/40 text-danger' : 'border-line text-steel'}`}>
        <MessageSquare className="size-3" aria-hidden="true" />{sms === 'yes' ? 'SMS' : sms === 'out' ? 'STOP' : 'SMS'}
        <span className="sr-only">{sms === 'yes' ? 'consented' : sms === 'out' ? 'opted out' : 'no consent'}</span>
      </span>
      <span title={email ? 'Email subscribed' : 'Not subscribed'}
        className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[0.68rem] font-bold ${email ? 'border-clover/40 text-clover' : 'border-line text-steel line-through'}`}>
        <Mail className="size-3" aria-hidden="true" />Email<span className="sr-only">{email ? 'subscribed' : 'not subscribed'}</span>
      </span>
    </span>
  );
}

function ScoreMeter({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <span className="inline-flex items-center gap-2" title={`Lead score ${score}`}>
      <svg width="44" height="6" aria-hidden="true" className="shrink-0">
        <rect width="44" height="6" rx="3" fill="var(--gunmetal)" />
        <rect width={(clamped / 100) * 44} height="6" rx="3" fill={clamped >= 70 ? 'var(--clover)' : clamped >= 40 ? '#fcd34d' : 'var(--steel)'} />
      </svg>
      <span className="w-6 text-right text-sm font-bold tabular-nums">{score}</span>
    </span>
  );
}

/** Overdue beyond 1.5× the customer's own usual visit gap. */
export function AtRiskBadge({ ratio }: { ratio: number | null }) {
  return (
    <span title={ratio ? `${ratio}× their usual gap since last visit` : 'Overdue'} className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-amber-300">
      <TriangleAlert className="size-3" aria-hidden="true" />At risk
    </span>
  );
}

export function ContactFiltersForm({ filters, tags }: { filters: ContactFilters; tags: string[] }) {
  const select = `${fieldClass} h-10 text-sm`;
  return (
    <form role="search" action="/admin/marketing/contacts" className="mb-5 grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
      <label className="relative">
        <span className="sr-only">Search contacts</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-steel" aria-hidden="true" />
        <input name="q" type="search" defaultValue={filters.q} placeholder="Name, phone, email or tag" className={`${fieldClass} h-10 pl-9 text-sm`} />
      </label>
      <label><span className="sr-only">Stage</span>
        <select name="stage" defaultValue={filters.stage} className={select}>
          <option value="">All stages</option>
          <option value="at_risk">At risk</option>
          {Object.entries(STAGE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label><span className="sr-only">Consent</span>
        <select name="consent" defaultValue={filters.consent} className={select}>
          <option value="">Any consent</option>
          <option value="sms">SMS opted in</option>
          <option value="email">Email subscribed</option>
          <option value="none">No consent</option>
        </select>
      </label>
      <label><span className="sr-only">Tag</span>
        <select name="tag" defaultValue={filters.tag} className={select}>
          <option value="">Any tag</option>
          {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
        </select>
      </label>
      <button type="submit" className={buttonClass('secondary', 'sm')}>Filter</button>
    </form>
  );
}

export function ContactList({ rows }: { rows: ContactRow[] }) {
  return (
    <ul className="grid gap-px overflow-hidden rounded-md border border-line bg-line">
      <li aria-hidden="true" className="hidden grid-cols-[minmax(0,1.6fr)_7rem_6rem_minmax(0,1.2fr)_8.5rem_6rem_5.5rem] gap-4 bg-carbon-2 px-4 py-2.5 text-[0.68rem] font-semibold uppercase tracking-widest text-steel lg:grid">
        <span>Contact</span><span>Stage</span><span>Score</span><span>Tags</span><span>Consent</span><span>Source</span><span className="text-right">LTV</span>
      </li>
      {rows.map((c) => (
        <li key={c.id} className="bg-carbon-2">
          <Link href={`/admin/marketing/contacts/${c.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-gunmetal lg:grid-cols-[minmax(0,1.6fr)_7rem_6rem_minmax(0,1.2fr)_8.5rem_6rem_5.5rem]">
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 truncate font-bold">{c.name}{c.isFleet && <Truck className="size-3.5 text-steel" aria-label="Fleet" />}{c.atRisk && <AtRiskBadge ratio={c.overdueRatio} />}</span>
              <span className="block truncate text-xs text-steel">{c.phone ?? c.email ?? 'No contact info'}{c.lastPaidAt ? ` · last paid ${relativeTime(c.lastPaidAt)}` : ''}</span>
            </span>
            <span className="justify-self-end lg:justify-self-start"><Badge tone={STAGE_TONE[c.stage] ?? 'neutral'}>{STAGE_LABEL[c.stage] ?? c.stage}</Badge></span>
            <span className="hidden lg:block"><ScoreMeter score={c.score} /></span>
            <span className="col-span-2 flex min-w-0 flex-wrap gap-1 lg:col-span-1">
              {c.tags.slice(0, 3).map((t) => <span key={t} className="rounded-sm bg-gunmetal px-1.5 py-0.5 text-[0.7rem] font-semibold text-chalk/75">{t}</span>)}
              {c.tags.length > 3 && <span className="text-[0.7rem] text-steel">+{c.tags.length - 3}</span>}
            </span>
            <span className="lg:order-none"><ConsentDots sms={c.sms} email={c.email_ok} /></span>
            <span className="justify-self-end text-xs text-steel lg:justify-self-start lg:text-sm lg:text-chalk/75">
              <span className="lg:hidden">Score {c.score} · </span>{sourceLabel(c.source)}
            </span>
            <span className="hidden text-right font-bold tabular-nums lg:block">{money(c.ltvCents, { whole: true })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
