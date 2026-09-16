import type { Tables } from '@/lib/db/database.types';
import { BUSINESS } from '@/lib/site';
import { dateOnly, money, vehicleLabel } from '@/lib/format';
import type { InvoiceLine } from './invoice-lines';

interface InvoiceDocumentProps {
  invoice: Tables<'invoices'> & {
    customers: { full_name: string; phone: string | null; email: string | null } | null;
    work_orders: { number: number; title: string; mileage_in: number | null; vehicles: { year: number | null; make: string | null; model: string | null; engine_code: string | null; vin: string | null } | null } | null;
    payments: { id: string; amount_cents: number; method: string; created_at: string }[];
  };
  lines: InvoiceLine[];
  overdue: boolean;
}

const KIND_LABEL = { labor: 'Labor', part: 'Part', fee: 'Fee' } as const;

/** The invoice as paper: light sheet on screen, prints edge to edge on white. */
export function InvoiceDocument({ invoice, lines, overdue }: InvoiceDocumentProps) {
  const vehicle = invoice.work_orders?.vehicles;
  const stamp = invoice.status === 'paid' ? { text: 'Paid', className: 'border-[#0f8a2a] text-[#0f8a2a]' } : invoice.status === 'void' ? { text: 'Void', className: 'border-neutral-500 text-neutral-500' } : overdue ? { text: 'Overdue', className: 'border-[#c43d2f] text-[#c43d2f]' } : { text: 'Due', className: 'border-neutral-800 text-neutral-800' };

  return (
    <article id="invoice-doc" className="relative overflow-hidden rounded-md bg-[#f7f8f6] text-[#111412] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] print:rounded-none">
      <div className="h-2 bg-[#1fbf3f] print:h-1.5" aria-hidden="true" />
      <div className="p-5 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="display text-3xl not-italic leading-none"><span className="text-[#0f8a2a]">Lucky</span> Diesel</p>
            <p className="mt-2 text-sm text-neutral-600">{BUSINESS.legalName} · {BUSINESS.city}, {BUSINESS.region}</p>
            <p className="text-sm text-neutral-600">{BUSINESS.phoneDisplay} · {BUSINESS.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Invoice</p>
            <p className="display text-5xl not-italic leading-none">#{invoice.number}</p>
            <p className={`mt-3 inline-block -rotate-3 rounded-sm border-2 px-3 py-0.5 text-sm font-black uppercase tracking-[0.2em] ${stamp.className}`}>{stamp.text}</p>
          </div>
        </header>

        <div className="mt-8 grid gap-6 border-y border-neutral-300 py-5 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Bill to</p>
            <p className="mt-1 font-semibold">{invoice.customers?.full_name}</p>
            {invoice.customers?.phone && <p className="text-neutral-600">{invoice.customers.phone}</p>}
            {invoice.customers?.email && <p className="break-all text-neutral-600">{invoice.customers.email}</p>}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Vehicle</p>
            <p className="mt-1 font-semibold">{vehicleLabel(vehicle)}</p>
            {vehicle?.vin && <p className="break-all font-mono text-xs text-neutral-600">VIN {vehicle.vin}</p>}
            {invoice.work_orders?.mileage_in && <p className="text-neutral-600">{invoice.work_orders.mileage_in.toLocaleString('en-US')} mi in</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">Details</p>
            <p className="mt-1">Issued {dateOnly(invoice.created_at)}</p>
            {invoice.due_at && invoice.status === 'open' && <p className={overdue ? 'font-bold text-[#c43d2f]' : ''}>Due {dateOnly(invoice.due_at)}</p>}
            {invoice.paid_at && <p className="font-semibold text-[#0f8a2a]">Paid {dateOnly(invoice.paid_at)}</p>}
            {invoice.work_orders && <p className="text-neutral-600">Work order #{invoice.work_orders.number}</p>}
          </div>
        </div>

        {invoice.work_orders?.title && <p className="display mt-6 text-2xl not-italic">{invoice.work_orders.title}</p>}

        <div className="-mx-5 mt-4 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b-2 border-[#111412] text-xs uppercase tracking-widest text-neutral-500">
                <th scope="col" className="py-2 pr-3 font-bold">Description</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Qty / hrs</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Rate</th>
                <th scope="col" className="py-2 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={`${line.description}-${index}`} className="border-b border-neutral-200">
                  <td className="py-2.5 pr-3">
                    <span className="mr-2 text-[0.65rem] font-bold uppercase tracking-widest text-neutral-500">{KIND_LABEL[line.kind]}</span>
                    {line.description}
                    {!line.taxable && <span className="ml-1 text-xs text-neutral-500">(non-taxable)</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{line.quantity}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{money(line.unitPriceCents)}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">{money(Math.round(line.quantity * line.unitPriceCents))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto mt-5 grid max-w-xs gap-1.5 text-sm">
          <div className="flex justify-between gap-6"><dt className="text-neutral-600">Subtotal</dt><dd className="tabular-nums">{money(invoice.subtotal_cents)}</dd></div>
          <div className="flex justify-between gap-6"><dt className="text-neutral-600">Sales tax</dt><dd className="tabular-nums">{money(invoice.tax_cents)}</dd></div>
          <div className="flex justify-between gap-6 border-t-2 border-[#111412] pt-2 text-lg font-bold"><dt>Total</dt><dd className="tabular-nums">{money(invoice.total_cents)}</dd></div>
          {invoice.payments.map((p) => (
            <div key={p.id} className="flex justify-between gap-6 text-[#0f8a2a]"><dt className="capitalize">Paid · {p.method}</dt><dd className="tabular-nums">−{money(p.amount_cents)}</dd></div>
          ))}
          {invoice.status !== 'void' && (
            <div className="flex justify-between gap-6 border-t border-neutral-300 pt-2 font-bold">
              <dt>Balance due</dt>
              <dd className="tabular-nums">{money(Math.max(0, invoice.total_cents - invoice.payments.reduce((s, p) => s + p.amount_cents, 0)))}</dd>
            </div>
          )}
        </dl>

        <footer className="mt-10 border-t border-neutral-300 pt-4 text-xs leading-relaxed text-neutral-500">
          Thanks for trusting Lucky Diesel with your truck. Parts carry the manufacturer’s warranty; ask us for details on your install.
          Questions about this invoice? Call or text {BUSINESS.phoneDisplay}.
        </footer>
      </div>
    </article>
  );
}
