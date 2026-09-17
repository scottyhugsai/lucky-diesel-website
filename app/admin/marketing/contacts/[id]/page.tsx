import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { loadContactDetail, type TimelineKind } from '@/components/admin/marketing/core-ui/contact-detail-data';
import { ConsentDots } from '@/components/admin/marketing/core-ui/ContactList';
import { CampaignPanel, ConsentLedger, PrivacyPanel, ReferralPanel, TagsPanel, TruckPanel } from '@/components/admin/marketing/core-ui/ContactPanels';
import { ContactTimeline, TIMELINE_FILTERS } from '@/components/admin/marketing/core-ui/ContactTimeline';
import { STAGE_LABEL, STAGE_TONE, sourceLabel } from '@/components/admin/marketing/core-ui/labels';
import { UUID_RE } from '@/components/admin/core/parse';
import { Badge, ButtonLink, Card } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { money } from '@/lib/format';

export const metadata = { title: 'Contact | Marketing' };

const KINDS: TimelineKind[] = ['touch', 'message', 'campaign', 'conversion', 'consent'];

export default async function ContactDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ show?: string }> }) {
  await requireRole('admin');
  const [{ id }, { show }] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(id)) notFound();
  const detail = await loadContactDetail(id);
  if (!detail) notFound();
  const { customer } = detail;
  const filter = KINDS.find((k) => k === show) ?? null;
  const sms = customer.sms_opted_out_at || customer.sms_marketing_opted_out_at ? 'out' : customer.sms_marketing_consent_at ? 'yes' : 'no';

  const stats = [
    { label: 'Lifetime value', value: money(detail.ltvCents, { whole: true }) },
    { label: 'Paid visits', value: String(detail.paidVisits) },
    { label: 'Lead score', value: String(customer.lead_score) },
    { label: 'First source', value: sourceLabel(customer.first_touch_source ?? customer.source) },
  ];

  return (
    <>
      <Link href="/admin/marketing/contacts" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-clover">
        <ArrowLeft className="size-4" aria-hidden="true" /> All contacts
      </Link>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STAGE_TONE[customer.lifecycle_stage] ?? 'neutral'}>{STAGE_LABEL[customer.lifecycle_stage]}</Badge>
            {customer.is_fleet && <Badge tone="info">Fleet</Badge>}
            <ConsentDots sms={sms} email={Boolean(customer.email) && customer.email_marketing_status === 'subscribed'} />
          </div>
          <h1 className="display mt-2 break-words text-4xl sm:text-5xl">{customer.full_name}</h1>
          <p className="mt-1 text-sm text-chalk/60">{[customer.phone, customer.email].filter(Boolean).join(' · ') || 'No contact info'}</p>
        </div>
        <ButtonLink href={`/admin/customers/${customer.id}`} variant="secondary" size="sm">Open customer <ExternalLink className="size-3.5" aria-hidden="true" /></ButtonLink>
      </header>

      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-carbon-2 px-4 py-3">
            <dt className="text-[0.68rem] font-semibold uppercase tracking-widest text-steel">{s.label}</dt>
            <dd className="display mt-1 truncate text-3xl not-italic tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card title="Timeline" padded>
          <nav aria-label="Timeline filter" className="-mx-1 mb-5 flex flex-wrap gap-1.5">
            {TIMELINE_FILTERS.map((f) => {
              const active = f.value === filter;
              const count = f.value ? detail.timeline.filter((e) => e.kind === f.value).length : detail.timeline.length;
              return (
                <Link key={f.label} href={f.value ? `?show=${f.value}` : '?'} scroll={false} aria-current={active ? 'true' : undefined}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${active ? 'border-clover bg-clover text-carbon' : 'border-line text-chalk/70 hover:border-chalk/30'}`}>
                  {f.label} <span className="tabular-nums opacity-70">{count}</span>
                </Link>
              );
            })}
          </nav>
          <ContactTimeline entries={detail.timeline} filter={filter} />
        </Card>

        <div className="grid content-start gap-6">
          <TagsPanel id={customer.id} tags={customer.tags} />
          <TruckPanel id={customer.id} trucks={detail.trucks} />
          <CampaignPanel id={customer.id} campaigns={detail.campaigns} enrolledIds={detail.enrolledIds} />
          <ReferralPanel id={customer.id} referral={detail.referral} referrals={detail.referrals} />
          <ConsentLedger id={customer.id} events={detail.consent} />
          <PrivacyPanel id={customer.id} erasedAt={customer.anonymized_at} />
          {detail.segments.length > 0 && (
            <Card title="In segments">
              <ul className="flex flex-wrap gap-1.5">
                {detail.segments.map((s) => (
                  <li key={s.id}><Link href={`/admin/marketing/contacts/segments/${s.id}`} className="inline-block rounded-sm border border-line px-2 py-1 text-sm hover:border-clover hover:text-clover">{s.name}</Link></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
