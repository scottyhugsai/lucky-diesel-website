import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { CopyPayLink, PrintButton } from '@/components/admin/core/InvoiceTools';
import { InvoiceDocument } from '@/components/admin/core/InvoiceDocument';
import { DiscountsCard } from '@/components/admin/invoices/DiscountsCard';
import { PaymentForm } from '@/components/admin/core/JobControls';
import { parseInvoiceLines } from '@/components/admin/core/invoice-lines';
import { UUID_RE } from '@/components/admin/core/parse';
import { requestNow } from '@/components/admin/core/time';
import { Card } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { dateTime, money } from '@/lib/format';
import { loadInvoiceDiscountState } from '@/lib/marketing/core/redemption';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Invoice | Lucky Diesel Admin' };

/* Print only the invoice sheet, on white, without the app chrome. */
const PRINT_CSS = `
@media print {
  @page { margin: 12mm; }
  html, body { background: #fff !important; }
  aside, nav[aria-label="App"], header.sticky { display: none !important; }
  body * { visibility: hidden !important; }
  #invoice-doc, #invoice-doc * { visibility: visible !important; }
  #invoice-doc { position: absolute; inset: 0 auto auto 0; width: 100%; box-shadow: none !important; border: 0 !important; }
}`;

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin');
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, customers(id, full_name, phone, email), work_orders(id, number, title, mileage_in, completed_at, vehicles(year, make, model, engine_code, vin)), payments(id, amount_cents, method, created_at)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Could not load invoice: ${error.message}`);
  if (!invoice) notFound();

  const lines = parseInvoiceLines(invoice.line_snapshot);
  const discounts = await loadInvoiceDiscountState(invoice.id);
  const payLink = `/portal/invoices/${invoice.id}`;
  const overdue = invoice.status === 'open' && Boolean(invoice.due_at && new Date(invoice.due_at).getTime() < requestNow());

  return (
    <div>
      <style>{PRINT_CSS}</style>
      <Link href="/admin/invoices" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:text-chalk print:hidden">
        <ArrowLeft className="size-4" aria-hidden="true" /> Invoices
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <InvoiceDocument invoice={invoice} lines={lines} overdue={overdue} discounts={discounts?.applied ?? []} />

        <div className="grid gap-4 print:hidden">
          <Card title="Actions">
            <div className="flex flex-wrap gap-2">
              <PrintButton />
              <CopyPayLink path={payLink} />
            </div>
            <p className="mt-3 break-all text-xs text-steel">Customer pays online at <span className="font-mono text-chalk/70">{payLink}</span></p>
          </Card>

          {discounts && (discounts.editable || discounts.applied.length > 0) && <DiscountsCard invoiceId={invoice.id} state={discounts} />}

          {invoice.status === 'open' ? (
            <Card title="Record payment">
              <PaymentForm invoiceId={invoice.id} totalCents={invoice.total_cents} />
            </Card>
          ) : (
            <Card title="Payments">
              {invoice.payments.length ? (
                <ul className="grid gap-2 text-sm">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="flex items-baseline justify-between gap-3">
                      <span><span className="font-semibold capitalize">{p.method}</span> <span className="text-xs text-steel">{dateTime(p.created_at)}</span></span>
                      <span className="font-bold tabular-nums text-clover">{money(p.amount_cents)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-steel">{invoice.status === 'void' ? 'This invoice was voided.' : 'No payment records.'}</p>
              )}
            </Card>
          )}

          <Card title="Related">
            <ul className="grid gap-2 text-sm">
              {invoice.work_orders && <li><Link href={`/admin/jobs/${invoice.work_orders.id}`} className="font-semibold text-clover hover:underline">WO #{invoice.work_orders.number} · {invoice.work_orders.title}</Link></li>}
              {invoice.customers && <li><Link href={`/admin/customers/${invoice.customers.id}`} className="font-semibold text-clover hover:underline">{invoice.customers.full_name}</Link></li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
