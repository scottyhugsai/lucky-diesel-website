import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, MessageSquare } from 'lucide-react';
import { UUID_RE } from '@/components/admin/core/parse';
import { AudienceForm, CampaignControls } from '@/components/admin/marketing/core-ui/CampaignControls';
import { CampaignReport } from '@/components/admin/marketing/core-ui/CampaignReport';
import { defaultSendAt, loadCampaignDetail } from '@/components/admin/marketing/core-ui/campaigns-data';
import { CAMPAIGN_STATUS_TONE, EVENT_LABEL, hourLabel, KIND_LABEL } from '@/components/admin/marketing/core-ui/labels';
import { StepsEditor } from '@/components/admin/marketing/core-ui/StepsEditor';
import { Badge, Card } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { dateTime } from '@/lib/format';

export const metadata = { title: 'Campaign | Marketing' };

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireRole('admin');
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(id)) notFound();
  const detail = await loadCampaignDetail(id);
  if (!detail) notFound();
  const { campaign, settings } = detail;
  const channel = campaign.channel === 'sms' ? 'sms' : 'email';
  const Icon = channel === 'sms' ? MessageSquare : Mail;
  const steps = detail.steps.map((s) => ({ order: s.step_order, variant: s.variant === 'B' ? ('B' as const) : ('A' as const), delayMinutes: s.delay_minutes, subject: s.subject ?? '', body: s.body }));

  const facts = [
    campaign.kind === 'broadcast'
      ? `To ${detail.segment ? `${detail.segment.name} (${detail.segment.member_count})` : 'no segment yet'}`
      : `Starts on ${campaign.trigger_event ? EVENT_LABEL[campaign.trigger_event] ?? campaign.trigger_event : 'segment join'}`,
    campaign.scheduled_at && campaign.kind === 'broadcast' ? `Send ${dateTime(campaign.scheduled_at)}` : null,
    `Window ${hourLabel(Math.max(campaign.send_window_start_hour, settings.quietHoursEnd))}–${hourLabel(Math.min(campaign.send_window_end_hour, settings.quietHoursStart))}`,
    campaign.kind !== 'broadcast' ? `${detail.enrollments.active} active · ${detail.enrollments.completed} done · ${detail.enrollments.exited} exited` : null,
  ].filter(Boolean);

  return (
    <>
      <Link href="/admin/marketing/campaigns" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-clover">
        <ArrowLeft className="size-4" aria-hidden="true" /> All campaigns
      </Link>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status] ?? 'neutral'}>{campaign.status}</Badge>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-steel"><Icon className="size-3.5" aria-hidden="true" />{KIND_LABEL[campaign.kind]} · {channel === 'sms' ? 'Text' : 'Email'}</span>
          {campaign.ab_test_percent > 0 && <Badge tone="violet">A/B · {campaign.ab_test_percent}%</Badge>}
        </div>
        <h1 className="display mt-2 break-words text-4xl sm:text-5xl">{campaign.name}</h1>
        <p className="mt-2 text-sm text-chalk/65">{facts.join(' · ')}</p>
      </header>
      {notice && <p role="status" className="mb-5 rounded-sm border border-clover/35 bg-clover/10 px-3 py-2 text-sm font-semibold text-clover">{notice.slice(0, 300)}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-6">
          <Card title="Results">
            <CampaignReport report={detail.report} winner={campaign.ab_winner_variant} metric={campaign.ab_winner_metric} />
          </Card>
          <Card title="Messages">
            <StepsEditor id={campaign.id} channel={channel} kind={campaign.kind} initial={steps} exitOn={campaign.exit_on} editable={['draft', 'paused'].includes(campaign.status)} />
          </Card>
        </div>
        <div className="grid min-w-0 content-start gap-6">
          <CampaignControls campaign={campaign} defaultSendAt={defaultSendAt(1)} />
          <AudienceForm campaign={campaign} segments={detail.segments} />
        </div>
      </div>
    </>
  );
}
