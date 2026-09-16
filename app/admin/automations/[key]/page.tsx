import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AutomationSwitch } from '@/components/admin/ops/AutomationSwitch';
import { AUDIENCE_LABEL, COMMON_PLACEHOLDERS, triggerLabel } from '@/components/admin/ops/automation-meta';
import { RunsTable } from '@/components/admin/ops/RunsTable';
import { TemplateEditor, type EditableTemplate } from '@/components/admin/ops/TemplateEditor';
import { Badge, Card, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { AUTOMATIONS, describeTiming } from '@/lib/automations/catalog';
import { templatePlaceholders } from '@/lib/messaging/template';
import { createClient } from '@/lib/supabase/server';

const KEY_PATTERN = /^[a-z0-9_]{1,64}$/;

export default async function AutomationEditorPage({ params }: { params: Promise<{ key: string }> }) {
  await requireRole('admin');
  const { key } = await params;
  if (!KEY_PATTERN.test(key)) notFound();

  const supabase = await createClient();
  const [{ data: automation }, { data: runs }] = await Promise.all([
    supabase.from('automations').select('*').eq('key', key).maybeSingle(),
    supabase
      .from('automation_runs')
      .select('id, automation_key, subject_type, subject_id, status, scheduled_for, executed_at, detail')
      .eq('automation_key', key)
      .order('scheduled_for', { ascending: false })
      .limit(15),
  ]);
  if (!automation) notFound();

  const definition = AUTOMATIONS.find((a) => a.key === key) ?? null;
  const defaults: EditableTemplate | null = definition
    ? { sms: definition.sms ?? '', subject: definition.emailSubject ?? '', body: definition.emailBody ?? '', delayMinutes: definition.delayMinutes }
    : null;
  const current: EditableTemplate = {
    sms: automation.sms_template ?? '',
    subject: automation.email_subject_template ?? '',
    body: automation.email_body_template ?? '',
    delayMinutes: automation.delay_minutes,
  };
  const sources = [definition?.sms, definition?.emailSubject, definition?.emailBody, current.sms, current.subject, current.body];
  const placeholders = [...new Set([...sources.flatMap((t) => (t ? templatePlaceholders(t) : [])), ...COMMON_PLACEHOLDERS])];
  const anchor = automation.anchor === 'before_appointment' ? 'before_appointment' : 'event';

  return (
    <>
      <Link href="/admin/automations" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-clover">
        <ArrowLeft className="size-4" aria-hidden="true" /> All automations
      </Link>
      <PageHeader
        kicker={triggerLabel(automation.trigger_event)}
        title={automation.name}
        description={automation.description}
        actions={<AutomationSwitch automationKey={automation.key} name={automation.name} enabled={automation.enabled} />}
      />
      <div className="-mt-3 mb-6 flex flex-wrap gap-2">
        <Badge tone="good">{describeTiming({ anchor, delayMinutes: automation.delay_minutes })}</Badge>
        <Badge>{automation.channels.map((c) => (c === 'sms' ? 'Text' : 'Email')).join(' + ')}</Badge>
        <Badge>To: {AUDIENCE_LABEL[automation.audience] ?? automation.audience}</Badge>
        {!automation.enabled && <Badge tone="warn">Turned off — nothing sends</Badge>}
      </div>

      <TemplateEditor
        automationKey={automation.key}
        channels={automation.channels}
        beforeAppointment={anchor === 'before_appointment'}
        audience={automation.audience}
        current={current}
        defaults={defaults}
        placeholders={placeholders}
      />

      <Card
        title="Recent runs"
        className="mt-8"
        padded={false}
        action={<Link href={`/admin/automations/runs?automation=${automation.key}`} className="text-sm font-semibold text-clover hover:underline">Full log</Link>}
      >
        <div className="p-4 sm:p-0">
          <RunsTable runs={runs ?? []} names={new Map([[automation.key, automation.name]])} showAutomation={false} />
        </div>
      </Card>
    </>
  );
}
