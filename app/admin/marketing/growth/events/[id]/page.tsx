import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRegistrationStatus } from '@/app/admin/marketing/growth/event-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { UUID_RE } from '@/components/admin/core/parse';
import { Metric, shortDate } from '@/components/admin/marketing/growth-ui/kit';
import { loadEventDetail, type RegistrationRow } from '@/components/admin/marketing/growth-ui/offers-events-data';
import { Badge, EmptyState, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';

export const metadata = { title: 'Event check-in | Lucky Diesel admin' };

const TONE: Record<string, 'neutral' | 'good' | 'warn' | 'bad' | 'info'> = { registered: 'info', checked_in: 'good', waitlist: 'warn', cancelled: 'bad', no_show: 'bad' };
const LABEL: Record<string, string> = { registered: 'Signed up', checked_in: 'Here', waitlist: 'Waitlist', cancelled: 'Cancelled', no_show: 'No-show' };

function StatusButton({ id, status, label, variant = 'secondary' }: { id: string; status: string; label: string; variant?: 'primary' | 'secondary' | 'ghost' }) {
  return (
    <ActionForm action={setRegistrationStatus} feedback="none">
      <input type="hidden" name="registration_id" value={id} />
      <input type="hidden" name="status" value={status} />
      <PendingButton size="sm" variant={variant}>{label}</PendingButton>
    </ActionForm>
  );
}

function Row({ reg }: { reg: RegistrationRow }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-carbon-2 p-3 sm:p-4">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold">{reg.name} <Badge tone={TONE[reg.status]}>{LABEL[reg.status] ?? reg.status}</Badge></p>
        <p className="text-sm text-steel">
          {[reg.vehicle, reg.phone].filter(Boolean).join(' · ') || 'No details'}{reg.mediaConsent ? ' · OK to film' : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {reg.status !== 'checked_in' && <StatusButton id={reg.id} status="checked_in" label="Check in" variant="primary" />}
        {reg.status === 'waitlist' && <StatusButton id={reg.id} status="registered" label="Give spot" />}
        {reg.status === 'checked_in' && <StatusButton id={reg.id} status="registered" label="Undo" variant="ghost" />}
        {reg.status === 'registered' && <StatusButton id={reg.id} status="no_show" label="No-show" variant="ghost" />}
      </div>
    </li>
  );
}

export default async function EventCheckInPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin');
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const detail = await loadEventDetail(id);
  if (!detail) notFound();
  const { event, registrations } = detail;
  const active = registrations.filter((r) => r.status !== 'cancelled');
  return (
    <>
      <Link href="/admin/marketing/growth?tab=events" className="text-sm font-semibold text-chalk/60 hover:text-clover">← Events</Link>
      <PageHeader kicker={shortDate(event.startsAt, true)} title={event.name} description="Tap Check in as trucks arrive." />
      <div className="mb-6 grid grid-cols-3 gap-4 rounded-md border border-line bg-carbon-2 p-4 sm:p-5">
        <Metric label="Signed up" value={`${event.registered}${event.capacity ? `/${event.capacity}` : ''}`} />
        <Metric label="Here" value={event.checkedIn} tone="good" />
        <Metric label="Waitlist" value={event.waitlist} tone={event.waitlist ? 'warn' : 'neutral'} />
      </div>
      {active.length === 0 ? <EmptyState title="No sign-ups yet">Share the event link.</EmptyState> : (
        <ul className="grid gap-2">{active.map((r) => <Row key={r.id} reg={r} />)}</ul>
      )}
    </>
  );
}
