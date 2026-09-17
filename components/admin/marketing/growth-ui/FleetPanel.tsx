import { Mail, Phone } from 'lucide-react';
import { createFleet, linkFleetCustomer, updateFleet } from '@/app/admin/marketing/growth/fleet-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, EmptyState, fieldClass } from '@/components/app/ui';
import { CustomerSelect } from './forms';
import type { CustomerOption } from './growth-data';
import { Field, shortDate } from './kit';
import type { FleetRow } from './offers-events-data';

const TERMS: Record<string, string> = { due_on_receipt: 'Due on receipt', net_15: 'Net 15', net_30: 'Net 30' };

function FleetFields({ fleet, prefix }: { fleet?: FleetRow; prefix: string }) {
  return (
    <>
      <Field label="Contact" htmlFor={`${prefix}-contact`}><input id={`${prefix}-contact`} name="contact_name" defaultValue={fleet?.contactName ?? ''} maxLength={120} className={fieldClass} /></Field>
      <Field label="Phone" htmlFor={`${prefix}-phone`}><input id={`${prefix}-phone`} name="phone" type="tel" defaultValue={fleet?.phone ?? ''} className={fieldClass} /></Field>
      <Field label="Email" htmlFor={`${prefix}-email`}><input id={`${prefix}-email`} name="email" type="email" defaultValue={fleet?.email ?? ''} className={fieldClass} /></Field>
      <Field label="Billing" htmlFor={`${prefix}-terms`}>
        <select id={`${prefix}-terms`} name="billing_terms" defaultValue={fleet?.billingTerms ?? 'due_on_receipt'} className={fieldClass}>
          {Object.entries(TERMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="PM every (days)" htmlFor={`${prefix}-days`}><input id={`${prefix}-days`} name="pm_interval_days" type="number" min={7} max={365} required defaultValue={fleet?.pmDays ?? 90} className={fieldClass} /></Field>
      <Field label="or (miles)" htmlFor={`${prefix}-miles`}><input id={`${prefix}-miles`} name="pm_interval_miles" type="number" min={500} max={50000} step={500} required defaultValue={fleet?.pmMiles ?? 10000} className={fieldClass} /></Field>
      <Field label="Notes" htmlFor={`${prefix}-notes`} className="sm:col-span-2"><input id={`${prefix}-notes`} name="notes" defaultValue={fleet?.notes ?? ''} maxLength={1000} className={fieldClass} /></Field>
    </>
  );
}

function FleetCard({ fleet, customers }: { fleet: FleetRow; customers: CustomerOption[] }) {
  const due = fleet.trucks.filter((t) => t.overdue).length;
  return (
    <li className="rounded-md border border-line bg-carbon-2">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h3 className="display text-2xl not-italic">{fleet.name}</h3>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-chalk/75">
            {fleet.contactName && <span>{fleet.contactName}</span>}
            {fleet.phone && <a href={`tel:${fleet.phone.replace(/\D/g, '')}`} className="inline-flex items-center gap-1 hover:text-clover"><Phone className="size-3.5" aria-hidden="true" />{fleet.phone}</a>}
            {fleet.email && <a href={`mailto:${fleet.email}`} className="inline-flex items-center gap-1 hover:text-clover"><Mail className="size-3.5" aria-hidden="true" />{fleet.email}</a>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge>{fleet.trucks.length} trucks</Badge>
          {due > 0 ? <Badge tone="warn">{due} PM due</Badge> : fleet.trucks.length > 0 && <Badge tone="good">PM current</Badge>}
          <Badge>{TERMS[fleet.billingTerms] ?? fleet.billingTerms}</Badge>
        </div>
      </div>
      {fleet.trucks.length > 0 && (
        <ul className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
          {fleet.trucks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 bg-carbon-2 px-4 py-3 text-sm sm:px-5">
              <span className="min-w-0"><span className="block truncate font-semibold">{t.label}</span><span className="text-xs text-steel">Last service {shortDate(t.lastService)}</span></span>
              <span className={`shrink-0 font-mono text-xs ${t.overdue ? 'text-amber-300' : 'text-clover'}`}>{t.nextDue ? `Due ${shortDate(t.nextDue)}` : 'No history'}</span>
            </li>
          ))}
        </ul>
      )}
      <details className="group border-t border-line">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-chalk/75 hover:text-clover sm:px-5">Edit schedule &amp; trucks</summary>
        <div className="grid gap-5 px-4 pb-5 sm:px-5">
          <ActionForm action={updateFleet} className="grid gap-3 sm:grid-cols-2" aria-label={`Edit ${fleet.name}`}>
            <input type="hidden" name="fleet_id" value={fleet.id} />
            <FleetFields fleet={fleet} prefix={`fl-${fleet.id}`} />
            <div className="sm:col-span-2"><PendingButton size="sm">Save</PendingButton></div>
          </ActionForm>
          <ActionForm action={linkFleetCustomer} className="flex flex-wrap items-end gap-2" aria-label={`Add trucks to ${fleet.name}`}>
            <input type="hidden" name="fleet_id" value={fleet.id} />
            <Field label="Add a customer’s trucks" htmlFor={`fl-cust-${fleet.id}`} className="min-w-0 flex-1 sm:max-w-xs"><CustomerSelect customers={customers} id={`fl-cust-${fleet.id}`} /></Field>
            <PendingButton size="md" variant="secondary">Add trucks</PendingButton>
          </ActionForm>
        </div>
      </details>
    </li>
  );
}

export function FleetPanel({ fleets, customers }: { fleets: FleetRow[]; customers: CustomerOption[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-label="Fleet accounts" className="min-w-0">
        {fleets.length === 0 ? <EmptyState title="No fleet accounts">Add a company on the right.</EmptyState> : (
          <ul className="grid gap-3">{fleets.map((f) => <FleetCard key={f.id} fleet={f} customers={customers} />)}</ul>
        )}
      </section>
      <Card title="New fleet account">
        <ActionForm action={createFleet} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1" aria-label="New fleet account">
          <Field label="Company" htmlFor="nf-name" className="sm:col-span-2 lg:col-span-1"><input id="nf-name" name="name" required maxLength={120} className={fieldClass} /></Field>
          <FleetFields prefix="nf" />
          <div><PendingButton>Add account</PendingButton></div>
        </ActionForm>
      </Card>
    </div>
  );
}
