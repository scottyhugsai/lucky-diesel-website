import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarCheck, Mail, MessageSquare, Phone } from 'lucide-react';
import { AutomationTimeline } from '@/components/admin/ops/AutomationTimeline';
import { ConvertLeadForm } from '@/components/admin/ops/ConvertLeadForm';
import { isUuid } from '@/components/admin/ops/form';
import { LeadStatusButtons } from '@/components/admin/ops/LeadStatusButtons';
import { RESPOND_WITHIN_MIN } from '@/components/admin/ops/LeadCard';
import { ageLabel, shopDate } from '@/components/admin/ops/time';
import { Badge, Card, PageHeader, buttonClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

const STATUS_TONE = { new: 'warn', contacted: 'info', booked: 'good', won: 'good', lost: 'bad' } as const;
const RUN_FIELDS = 'id, automation_key, subject_type, subject_id, status, scheduled_for, executed_at, detail';

function digits(phone: string) {
  return phone.replace(/\D/g, '');
}

const CONVERTED_NOTICE: Record<string, { tone: 'good' | 'warn'; text: string }> = {
  estimate: { tone: 'good', text: 'Converted. Customer, truck and estimate are ready.' },
  booked: { tone: 'good', text: 'Converted and booked. The confirmation just went out and the 24h and 2h reminders are scheduled. Follow-ups for this lead will skip themselves.' },
  'booking-failed': { tone: 'warn', text: 'Converted, but that time was just taken. Book another slot below.' },
};

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ converted?: string }> }) {
  await requireRole('admin');
  const [{ id }, { converted }] = await Promise.all([params, searchParams]);
  const notice = converted ? CONVERTED_NOTICE[converted] : undefined;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();

  const { data: lead } = await supabase.from('leads').select('*').eq('id', id).maybeSingle();
  if (!lead) notFound();

  const [{ data: jobs }, { data: appointments }, { data: automations }] = await Promise.all([
    supabase.from('work_orders').select('id, number, title, status').eq('lead_id', lead.id),
    lead.customer_id
      ? supabase.from('appointments').select('id, starts_at, status, service_label').eq('customer_id', lead.customer_id).gte('created_at', lead.created_at).order('starts_at')
      : Promise.resolve({ data: [] as { id: string; starts_at: string; status: string; service_label: string }[] }),
    supabase.from('automations').select('key, name'),
  ]);
  const subjectIds = [lead.id, ...(appointments ?? []).map((a) => a.id)];
  const { data: runs } = await supabase.from('automation_runs').select(RUN_FIELDS).in('subject_id', subjectIds).order('scheduled_for');

  const now = new Date();
  const urgent = lead.status === 'new' && now.getTime() - new Date(lead.created_at).getTime() > RESPOND_WITHIN_MIN * 60_000;
  const names = new Map((automations ?? []).map((a) => [a.key, a.name]));
  const phone = digits(lead.phone);
  const job = jobs?.[0];

  return (
    <>
      <Link href={`/admin/leads?status=${lead.status}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-clover">
        <ArrowLeft className="size-4" aria-hidden="true" /> Leads
      </Link>
      <PageHeader
        kicker={`Lead · ${ageLabel(lead.created_at, now)}`}
        title={lead.full_name}
        description={<span className="flex flex-wrap items-center gap-2"><Badge tone={STATUS_TONE[lead.status]}>{lead.status}</Badge>{urgent && <Badge tone="warn">Respond now</Badge>}<span>Requested {dateTime(lead.created_at)}</span></span>}
      />

      {notice && (
        <p role="status" className={`mb-5 rounded-sm border px-4 py-3 text-sm font-semibold ${notice.tone === 'good' ? 'border-clover/40 bg-clover/10 text-clover' : 'border-amber-400/40 bg-amber-400/10 text-amber-200'}`}>
          {notice.text}
        </p>
      )}

      <div className="mb-6 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        <a href={`tel:+1${phone.slice(-10)}`} className={`${buttonClass('primary')} flex-col gap-0.5 sm:flex-row sm:gap-2`}><Phone className="size-4" aria-hidden="true" />Call</a>
        <a href={`sms:+1${phone.slice(-10)}`} className={`${buttonClass('secondary')} flex-col gap-0.5 sm:flex-row sm:gap-2`}><MessageSquare className="size-4" aria-hidden="true" />Text</a>
        <a href={`mailto:${lead.email}?subject=${encodeURIComponent(`Your ${lead.service_label ?? 'service'} request`)}`} className={`${buttonClass('secondary')} flex-col gap-0.5 sm:flex-row sm:gap-2`}><Mail className="size-4" aria-hidden="true" />Email</a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="grid content-start gap-6">
          <Card title="Request">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {([
                ['Phone', lead.phone], ['Email', lead.email], ['Truck', lead.platform_label ?? '—'], ['Mileage', lead.mileage || '—'],
                ['Service', lead.service_label ?? '—'], ['Source', lead.source],
                ['SMS consent', lead.sms_consent ? `Yes${lead.consent_ip ? ` · IP ${lead.consent_ip}` : ''}` : 'No — email only'],
                ['First contacted', lead.contacted_at ? dateTime(lead.contacted_at) : 'Not yet'],
              ] as const).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-widest text-steel">{label}</dt>
                  <dd className="mt-0.5 break-words text-chalk">{value}</dd>
                </div>
              ))}
            </dl>
            {lead.details && <blockquote className="mt-4 whitespace-pre-wrap border-l-2 border-clover pl-4 text-chalk/80">{lead.details}</blockquote>}
          </Card>

          <Card title="Status">
            <LeadStatusButtons leadId={lead.id} status={lead.status} />
          </Card>

          <Card title="Automations for this lead">
            <AutomationTimeline runs={runs ?? []} names={names} />
          </Card>
        </div>

        <div className="grid content-start gap-6">
          {job || (appointments?.length ?? 0) > 0 ? (
            <Card title="Converted">
              {job && (
                <p className="text-sm">Estimate <Link href={`/admin/jobs/${job.id}`} className="font-semibold text-clover hover:underline">WO #{job.number} · {job.title}</Link> <span className="text-steel">({job.status.replace('_', ' ')})</span></p>
              )}
              <ul className="mt-3 grid gap-2">
                {(appointments ?? []).map((a) => (
                  <li key={a.id}>
                    <Link href={`/admin/calendar?appt=${a.id}&week=${shopDate(new Date(a.starts_at))}`} className="flex items-center gap-2 text-sm hover:text-clover">
                      <CalendarCheck className="size-4 text-clover" aria-hidden="true" />{dateTime(a.starts_at)} · {a.service_label} <Badge>{a.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
              {job && lead.customer_id && !(appointments?.length) && (
                <Link href={`/admin/calendar/new?customer=${lead.customer_id}`} className={`${buttonClass('secondary', 'sm')} mt-3`}>
                  <CalendarCheck className="size-4" aria-hidden="true" /> Book appointment
                </Link>
              )}
            </Card>
          ) : null}
          {lead.status !== 'lost' && !job && (
            <Card title="Convert">
              <ConvertLeadForm leadId={lead.id} serviceId={lead.service_id} today={shopDate(now)} vehicleText={lead.platform_label ?? 'from the request'} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
