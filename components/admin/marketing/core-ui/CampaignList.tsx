import Link from 'next/link';
import { CalendarClock, Mail, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/app/ui';
import { dateTime, money } from '@/lib/format';
import type { CampaignListRow } from './campaigns-data';
import { CAMPAIGN_STATUS_TONE, EVENT_LABEL, KIND_LABEL, pct } from './labels';

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.62rem] font-semibold uppercase tracking-widest text-steel">{label}</dt>
      <dd className={`text-lg font-bold tabular-nums ${accent ? 'text-clover' : ''}`}>{value}</dd>
    </div>
  );
}

export function CampaignList({ rows }: { rows: CampaignListRow[] }) {
  return (
    <ul className="grid gap-3">
      {rows.map(({ campaign, segmentName, audience, delivered, clicked, converted, revenueCents }) => {
        const Icon = campaign.channel === 'sms' ? MessageSquare : Mail;
        const target = campaign.kind === 'broadcast' ? segmentName ?? 'No audience yet' : campaign.trigger_event ? EVENT_LABEL[campaign.trigger_event] ?? campaign.trigger_event : segmentName ?? 'No trigger';
        return (
          <li key={campaign.id} className="group relative grid gap-4 rounded-md border border-line bg-carbon-2 p-4 transition-colors hover:border-clover/40 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-gunmetal text-clover" aria-hidden="true"><Icon className="size-5" /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status] ?? 'neutral'}>{campaign.status}</Badge>
                  <span className="text-xs font-semibold uppercase tracking-widest text-steel">{KIND_LABEL[campaign.kind]}</span>
                  {campaign.ab_test_percent > 0 && <Badge tone="violet">A/B</Badge>}
                </div>
                <h2 className="mt-1 truncate text-lg font-bold">
                  <Link href={`/admin/marketing/campaigns/${campaign.id}`} className="after:absolute after:inset-0 group-hover:text-clover">{campaign.name}</Link>
                </h2>
                <p className="truncate text-sm text-chalk/60">
                  {target}
                  {campaign.scheduled_at && campaign.status === 'scheduled' && (
                    <span className="ml-2 inline-flex items-center gap-1 text-sky-300"><CalendarClock className="size-3.5" aria-hidden="true" />{dateTime(campaign.scheduled_at)}</span>
                  )}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-4 gap-3 border-t border-line pt-3 md:border-t-0 md:pt-0">
              <Stat label={campaign.kind === 'broadcast' ? 'Audience' : 'Enrolled'} value={String(audience)} />
              <Stat label="Delivered" value={String(delivered)} />
              <Stat label="Clicks" value={delivered ? pct(clicked / delivered) : '—'} />
              <Stat label="Revenue" value={converted ? money(revenueCents, { whole: true }) : '—'} accent={revenueCents > 0} />
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
