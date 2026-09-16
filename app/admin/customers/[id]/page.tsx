import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, MessageSquare, Phone, Plus } from 'lucide-react';
import { ConsentControls, CustomerForm, InviteButton } from '@/components/admin/core/CustomerForms';
import { InvoiceHistory, JobHistory, LeadHistory, SmsBadge } from '@/components/admin/core/CustomerPanels';
import { MessagesView } from '@/components/admin/core/JobActivity';
import { TruckList } from '@/components/admin/core/TruckList';
import { loadCustomerDetail } from '@/components/admin/core/customers-data';
import { UUID_RE } from '@/components/admin/core/parse';
import { Badge, ButtonLink, Card, buttonClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { dateOnly, dateTime, money } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Customer | Lucky Diesel Admin' };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin');
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const [detail, { data: settings }] = await Promise.all([loadCustomerDetail(id), supabase.from('shop_settings').select('tax_rate').eq('id', 1).maybeSingle()]);
  if (!detail) notFound();

  const { customer, jobs, invoices, leads, messages } = detail;
  const smsStatus = customer.sms_opted_out_at ? 'opted_out' : customer.sms_consent ? 'consented' : 'none';
  const lifetime = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.total_cents, 0);
  const open = invoices.filter((i) => i.status === 'open').reduce((sum, i) => sum + i.total_cents, 0);
  const jobCounts = jobs.reduce<Record<string, number>>((acc, job) => ({ ...acc, [job.vehicle_id]: (acc[job.vehicle_id] ?? 0) + 1 }), {});
  const lastVisit = jobs[0]?.created_at;
  const dial = customer.phone?.replace(/[^\d+]/g, '');
  const contact = buttonClass('secondary', 'sm');

  const stats = [
    ['Lifetime value', money(lifetime, { whole: true }), 'text-clover'],
    ['Open balance', money(open, { whole: true }), open > 0 ? 'text-amber-300' : ''],
    ['Jobs', String(jobs.length), ''],
    ['Last visit', lastVisit ? dateOnly(lastVisit) : 'Never', ''],
  ] as const;

  return (
    <div>
      <Link href="/admin/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-chalk">
        <ArrowLeft className="size-4" aria-hidden="true" /> Customers
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div className="min-w-0">
          <p className="kicker">Customer since {dateOnly(customer.created_at)}</p>
          <h1 className="display mt-2 break-words text-4xl sm:text-5xl">{customer.full_name}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <SmsBadge status={smsStatus} />
            {customer.profile_id ? <Badge tone="violet">Portal account</Badge> : <Badge>No portal</Badge>}
            <span className="text-sm text-steel">via {customer.source}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dial && <a href={`tel:${dial}`} className={contact}><Phone className="size-4" aria-hidden="true" /> Call</a>}
          {dial && <a href={`sms:${dial}`} className={contact}><MessageSquare className="size-4" aria-hidden="true" /> Text</a>}
          {customer.email && <a href={`mailto:${customer.email}`} className={contact}><Mail className="size-4" aria-hidden="true" /> Email</a>}
          <ButtonLink href={`/admin/jobs/new?customer=${customer.id}`} size="sm"><Plus className="size-4" aria-hidden="true" /> New job</ButtonLink>
        </div>
      </header>

      <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-4">
        {stats.map(([label, value, tone]) => (
          <div key={label} className="bg-carbon-2 p-4">
            <dt className="text-xs font-semibold uppercase tracking-widest text-steel">{label}</dt>
            <dd className={`display mt-2 text-3xl not-italic tabular-nums ${tone}`}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="grid min-w-0 gap-6 lg:col-span-2">
          <Card title={`Trucks (${customer.vehicles.length})`}>
            <TruckList customerId={customer.id} vehicles={customer.vehicles} jobCounts={jobCounts} />
          </Card>
          <Card title="Job history"><JobHistory jobs={jobs} taxRate={Number(settings?.tax_rate ?? 0)} /></Card>
          <Card title="Invoices"><InvoiceHistory invoices={invoices} /></Card>
          <Card title="Messages"><MessagesView messages={messages} /></Card>
        </div>

        <div className="grid min-w-0 gap-6">
          <Card title="Contact"><CustomerForm customer={customer} /></Card>
          <Card title="Text messages">
            <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-steel">Status</dt><dd><SmsBadge status={smsStatus} /></dd>
              <dt className="text-steel">Consented</dt><dd>{customer.sms_consent_at ? dateTime(customer.sms_consent_at) : '—'}</dd>
              <dt className="text-steel">Terms version</dt><dd className="font-mono">{customer.sms_consent_version ?? '—'}</dd>
              <dt className="text-steel">Opted out</dt><dd className={customer.sms_opted_out_at ? 'text-danger' : ''}>{customer.sms_opted_out_at ? dateTime(customer.sms_opted_out_at) : '—'}</dd>
            </dl>
            <ConsentControls customerId={customer.id} status={smsStatus} />
          </Card>
          <Card title="Customer portal">
            {customer.profile_id ? (
              <p className="text-sm text-chalk/75">Has a portal login. They can see job status, approve estimates and pay invoices online.</p>
            ) : (
              <div className="grid gap-3">
                <p className="text-sm text-chalk/75">Invite them to track jobs, approve estimates with photos and pay online.</p>
                <InviteButton customerId={customer.id} hasEmail={Boolean(customer.email)} />
              </div>
            )}
          </Card>
          <Card title="Lead history"><LeadHistory leads={leads} /></Card>
        </div>
      </div>
    </div>
  );
}
