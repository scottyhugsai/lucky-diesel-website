import Link from 'next/link';
import { Mail, Phone, X } from 'lucide-react';
import { Badge } from '@/components/app/ui';
import { dateTime, timeOnly, vehicleLabel } from '@/lib/format';
import { AppointmentActions } from './AppointmentActions';
import { AutomationTimeline } from './AutomationTimeline';
import type { RunRow } from './RunsTable';

export interface AppointmentDetail {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  service_label: string;
  notes: string | null;
  work_order_id: string | null;
  customers: { id: string; full_name: string; phone: string | null; email: string | null; sms_consent: boolean } | null;
  vehicles: { year: number | null; make: string | null; model: string | null; engine_code: string | null; nickname: string | null } | null;
  work_orders: { number: number } | null;
}

const STATUS_TONE: Record<string, 'info' | 'good' | 'warn' | 'bad' | 'neutral'> = {
  scheduled: 'info', confirmed: 'good', checked_in: 'warn', completed: 'neutral', cancelled: 'bad', no_show: 'bad',
};

export function AppointmentPanel({ appointment, runs, names, closeHref }: { appointment: AppointmentDetail; runs: RunRow[]; names: Map<string, string>; closeHref: string }) {
  const customer = appointment.customers;
  return (
    <aside aria-labelledby="appt-heading" className="rounded-md border border-clover/30 bg-carbon-2 shadow-[0_20px_60px_-30px_var(--clover-glow)]">
      <div className="flex items-start justify-between gap-3 border-b border-line p-4">
        <div className="min-w-0">
          <p className="kicker">{dateTime(appointment.starts_at)}–{timeOnly(appointment.ends_at)}</p>
          <h2 id="appt-heading" className="display mt-1 text-3xl not-italic">{customer?.full_name ?? 'Unknown customer'}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={STATUS_TONE[appointment.status] ?? 'neutral'}>{appointment.status.replace('_', ' ')}</Badge>
            {customer && <Badge tone={customer.sms_consent ? 'good' : 'neutral'}>{customer.sms_consent ? 'SMS OK' : 'Email only'}</Badge>}
          </div>
        </div>
        <Link href={closeHref} scroll={false} aria-label="Close appointment" className="grid size-9 shrink-0 place-items-center rounded-sm text-steel hover:bg-gunmetal hover:text-chalk">
          <X className="size-4" />
        </Link>
      </div>
      <div className="grid gap-5 p-4">
        <dl className="grid gap-3 text-sm">
          <div><dt className="text-xs font-semibold uppercase tracking-widest text-steel">Service</dt><dd>{appointment.service_label}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-widest text-steel">Truck</dt><dd>{vehicleLabel(appointment.vehicles)}</dd></div>
          {appointment.notes && <div><dt className="text-xs font-semibold uppercase tracking-widest text-steel">Notes</dt><dd className="whitespace-pre-wrap">{appointment.notes}</dd></div>}
          <div>
            <dt className="text-xs font-semibold uppercase tracking-widest text-steel">Job</dt>
            <dd>
              {appointment.work_order_id ? (
                <Link href={`/admin/jobs/${appointment.work_order_id}`} className="font-semibold text-clover hover:underline">WO #{appointment.work_orders?.number ?? '—'} →</Link>
              ) : 'No job linked yet'}
            </dd>
          </div>
        </dl>
        {customer && (
          <div className="flex flex-wrap gap-2 text-sm">
            {customer.phone && <a href={`tel:${customer.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 hover:border-clover hover:text-clover"><Phone className="size-3.5" aria-hidden="true" />{customer.phone}</a>}
            {customer.email && <a href={`mailto:${customer.email}`} className="inline-flex max-w-full items-center gap-1.5 truncate rounded-sm border border-line px-3 py-1.5 hover:border-clover hover:text-clover"><Mail className="size-3.5" aria-hidden="true" />{customer.email}</a>}
          </div>
        )}
        <AppointmentActions appointmentId={appointment.id} status={appointment.status} />
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-steel">Confirmation & reminders</p>
          <AutomationTimeline runs={runs} names={names} empty="No messages for this appointment yet." />
        </div>
      </div>
    </aside>
  );
}
