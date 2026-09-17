import Link from 'next/link';
import { FileText, Mail, Phone } from 'lucide-react';
import { createFleet, importProspects, linkFleetCustomer, updateFleet } from '@/app/admin/marketing/growth/fleet-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, EmptyState, fieldClass } from '@/components/app/ui';
import { introEmail, MAX_PROSPECT_ROWS, PROSPECT_COLUMNS, TERMS_LABEL } from '@/lib/marketing/fleet/fleet-math';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import { CopyButton } from './CopyButton';
import { CustomerSelect } from './forms';
import type { CustomerOption } from './growth-data';
import { areaClass, Field, shortDate } from './kit';
import type { FleetRow } from './offers-events-data';

const TERMS: Record<string, string> = TERMS_LABEL;
const STAGES: Record<string, string> = { prospect: 'Prospect', active: 'Active', lost: 'Lost' };

function FleetFields({ fleet, prefix }: { fleet?: FleetRow; prefix: string }) {
  return (
    <>
      <Field label="Contact" htmlFor={`${prefix}-contact`}><input id={`${prefix}-contact`} name="contact_name" defaultValue={fleet?.contactName ?? ''} maxLength={120} className={fieldClass} /></Field>
      <Field label="Phone" htmlFor={`${prefix}-phone`}><input id={`${prefix}-phone`} name="phone" type="tel" defaultValue={fleet?.phone ?? ''} className={fieldClass} /></Field>
      <Field label="Email" htmlFor={`${prefix}-email`}><input id={`${prefix}-email`} name="email" type="email" defaultValue={fleet?.email ?? ''} className={fieldClass} /></Field>
      <Field label="Stage" htmlFor={`${prefix}-stage`}>
        <select id={`${prefix}-stage`} name="stage" defaultValue={fleet?.stage ?? 'active'} className={fieldClass}>
          {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="City" htmlFor={`${prefix}-city`}><input id={`${prefix}-city`} name="city" defaultValue={fleet?.city ?? ''} maxLength={80} className={fieldClass} /></Field>
      <Field label="Trucks" htmlFor={`${prefix}-trucks`}><input id={`${prefix}-trucks`} name="truck_count" type="number" min={0} max={100000} defaultValue={fleet?.truckCount ?? ''} className={fieldClass} /></Field>
      <Field label="Website" htmlFor={`${prefix}-site`} className="sm:col-span-2"><input id={`${prefix}-site`} name="website" defaultValue={fleet?.website ?? ''} maxLength={200} className={fieldClass} /></Field>
      <Field label="Billing" htmlFor={`${prefix}-terms`}>
        <select id={`${prefix}-terms`} name="billing_terms" defaultValue={fleet?.billingTerms ?? 'due_on_receipt'} className={fieldClass}>
          {Object.entries(TERMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="Fleet discount %" htmlFor={`${prefix}-disc`}><input id={`${prefix}-disc`} name="labor_discount_pct" type="number" min={0} max={50} required defaultValue={fleet?.laborDiscountPct ?? 0} className={fieldClass} /></Field>
      <Field label="Response (hours)" htmlFor={`${prefix}-sla`} hint="Used in the proposal."><input id={`${prefix}-sla`} name="sla_hours" type="number" min={4} max={336} required defaultValue={fleet?.slaHours ?? 48} className={fieldClass} /></Field>
      <Field label="PM every (days)" htmlFor={`${prefix}-days`}><input id={`${prefix}-days`} name="pm_interval_days" type="number" min={7} max={365} required defaultValue={fleet?.pmDays ?? 90} className={fieldClass} /></Field>
      <Field label="or (miles)" htmlFor={`${prefix}-miles`}><input id={`${prefix}-miles`} name="pm_interval_miles" type="number" min={500} max={50000} step={500} required defaultValue={fleet?.pmMiles ?? 10000} className={fieldClass} /></Field>
      <label htmlFor={`${prefix}-prio`} className="flex items-center gap-2 self-end text-sm font-semibold text-chalk/85">
        <input id={`${prefix}-prio`} name="priority" type="checkbox" defaultChecked={fleet?.priority ?? false} className="size-4 accent-[var(--clover)]" />
        Priority bays
      </label>
      <Field label="Notes" htmlFor={`${prefix}-notes`} className="sm:col-span-2"><input id={`${prefix}-notes`} name="notes" defaultValue={fleet?.notes ?? ''} maxLength={1000} className={fieldClass} /></Field>
    </>
  );
}

function EditForms({ fleet, customers }: { fleet: FleetRow; customers: CustomerOption[] }) {
  return (
    <details className="group border-t border-line">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-chalk/75 hover:text-clover sm:px-5">Edit account</summary>
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
            {fleet.city && <span className="text-steel">{fleet.city}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={fleet.stage === 'active' ? 'good' : fleet.stage === 'lost' ? 'neutral' : 'info'}>{STAGES[fleet.stage] ?? fleet.stage}</Badge>
          {fleet.priority && <Badge tone="good">Priority</Badge>}
          <Badge>{fleet.trucks.length || fleet.truckCount || 0} trucks</Badge>
          {due > 0 ? <Badge tone="warn">{due} PM due</Badge> : fleet.trucks.length > 0 && <Badge tone="good">PM current</Badge>}
          <Badge>{TERMS[fleet.billingTerms] ?? fleet.billingTerms}</Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3 sm:px-5">
        <Link href={`/admin/marketing/growth/fleet/${fleet.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line px-2.5 text-xs font-semibold text-chalk/80 hover:border-clover hover:text-clover">
          Report
        </Link>
        <Link href={`/admin/marketing/growth/fleet/${fleet.id}/proposal`} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line px-2.5 text-xs font-semibold text-chalk/80 hover:border-clover hover:text-clover">
          <FileText className="size-3.5" aria-hidden="true" /> Proposal
        </Link>
        {fleet.stage === 'prospect' && (
          <CopyButton
            label="Copy intro"
            value={(() => {
              const draft = introEmail({ name: fleet.name, contactName: fleet.contactName, truckCount: fleet.truckCount }, { name: BUSINESS.name, phone: BUSINESS.phoneDisplay, siteUrl: siteUrl() });
              return `${draft.subject}\n\n${draft.body}`;
            })()}
          />
        )}
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
      <EditForms fleet={fleet} customers={customers} />
    </li>
  );
}

export function FleetPanel({ fleets, customers }: { fleets: FleetRow[]; customers: CustomerOption[] }) {
  const accounts = fleets.filter((f) => f.stage !== 'prospect');
  const prospects = fleets.filter((f) => f.stage === 'prospect');
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 gap-6">
        <section aria-label="Fleet accounts" className="min-w-0">
          {accounts.length === 0 ? <EmptyState title="No fleet accounts">Add a company on the right.</EmptyState> : (
            <ul className="grid gap-3">{accounts.map((f) => <FleetCard key={f.id} fleet={f} customers={customers} />)}</ul>
          )}
        </section>
        {prospects.length > 0 && (
          <section aria-label="Prospects" className="min-w-0">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-steel">Prospects ({prospects.length})</h2>
            <ul className="grid gap-3">{prospects.map((f) => <FleetCard key={f.id} fleet={f} customers={customers} />)}</ul>
          </section>
        )}
      </div>
      <div className="grid gap-4">
        <Card title="New fleet account">
          <ActionForm action={createFleet} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1" aria-label="New fleet account">
            <Field label="Company" htmlFor="nf-name" className="sm:col-span-2 lg:col-span-1"><input id="nf-name" name="name" required maxLength={120} className={fieldClass} /></Field>
            <FleetFields prefix="nf" />
            <div><PendingButton>Add account</PendingButton></div>
          </ActionForm>
        </Card>
        <Card title="Import prospects" padded={false}>
          <details className="group">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-chalk/75 hover:text-clover">Paste a CSV</summary>
            <div className="px-4 pb-4">
              <ActionForm action={importProspects} resetOnSuccess className="grid gap-3" aria-label="Import prospects">
                <Field label="Source" htmlFor="ip-source"><input id="ip-source" name="source" defaultValue="import" maxLength={60} className={fieldClass} /></Field>
                <Field label="Rows" htmlFor="ip-csv" hint={`${PROSPECT_COLUMNS.join(', ')} — up to ${MAX_PROSPECT_ROWS} rows.`}>
                  <textarea id="ip-csv" name="csv" rows={6} required maxLength={60000} className={areaClass} placeholder={`${PROSPECT_COLUMNS.join(',')}\nPalmetto Hauling,Dana Reed,8439959252,dana@palmetto.com,12,Summerville`} />
                </Field>
                <div><PendingButton size="sm">Import</PendingButton></div>
              </ActionForm>
            </div>
          </details>
        </Card>
      </div>
    </div>
  );
}
