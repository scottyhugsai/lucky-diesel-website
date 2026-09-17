import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CircleCheck, Clock } from 'lucide-react';
import { Badge, Card } from '@/components/app/ui';
import { LineSummary, TotalsRows } from '@/components/portal/LineSummary';
import { NotLinked } from '@/components/portal/NotLinked';
import { PayPanel } from '@/components/portal/PayPanel';
import { parseSnapshotLines, type PortalLine } from '@/components/portal/lines';
import { requireRole } from '@/lib/auth';
import { dateOnly, dateTime, money, vehicleLabel } from '@/lib/format';
import { BUSINESS } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Invoice | Lucky Diesel' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METHOD_LABEL: Record<string, string> = { card: 'Card', cash: 'Cash', check: 'Check', demo: 'Card (test mode)' };

interface InvoicePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ checkout?: string }>;
}

export default async function InvoicePage({ params, searchParams }: InvoicePageProps) {
  const viewer = await requireRole('client');
  if (!viewer.customerId) return <NotLinked />;
  const [{ id }, { checkout }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', id).eq('customer_id', viewer.customerId).maybeSingle();
  if (!invoice) notFound();

  const [{ data: job }, { data: payments }] = await Promise.all([
    supabase.from('work_orders').select('id, number, title, vehicle_id').eq('id', invoice.work_order_id).maybeSingle(),
    supabase.from('payments').select('*').eq('invoice_id', id).order('created_at'),
  ]);
  const [{ data: vehicle }, fallback] = await Promise.all([
    job ? supabase.from('vehicles').select('*').eq('id', job.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    parseSnapshotLines(invoice.line_snapshot).length
      ? Promise.resolve({ data: null })
      : supabase.from('line_items').select('id, kind, description, quantity, unit_price_cents, taxable, approval, inspection_item_id').eq('work_order_id', invoice.work_order_id).eq('approval', 'approved').order('sort'),
  ]);
  const snapshot = parseSnapshotLines(invoice.line_snapshot);
  const lines: PortalLine[] = snapshot.length ? snapshot : (fallback.data ?? []).map((line) => ({ ...line, quantity: Number(line.quantity) }));
  const paid = invoice.status === 'paid';
  const lastPayment = payments?.at(-1);

  return (
    <div className="space-y-8">
      <header>
        <Link href="/portal/invoices" className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-sm px-2 text-sm font-semibold text-steel hover:text-chalk">
          <ArrowLeft className="size-4" aria-hidden="true" /> All invoices
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="kicker">Invoice #{invoice.number}</p>
            <h1 className="display mt-2 text-5xl sm:text-6xl tabular-nums">{money(invoice.total_cents)}</h1>
            <p className="mt-2 text-chalk/65">
              {job ? <Link href={`/portal/jobs/${job.id}`} className="underline decoration-line underline-offset-4 hover:text-clover">Job #{job.number} · {job.title}</Link> : null}
              {vehicle ? ` · ${vehicleLabel(vehicle)}` : ''}
            </p>
          </div>
          <Badge tone={paid ? 'good' : invoice.status === 'open' ? 'warn' : 'neutral'}>{paid ? 'Paid' : invoice.status === 'open' ? 'Due' : 'Void'}</Badge>
        </div>
      </header>

      {paid && (
        <section role="status" aria-live="polite" className="flex items-start gap-3 rounded-md border border-clover/40 bg-clover/[0.07] p-4 sm:p-6">
          <CircleCheck className="mt-1 size-7 shrink-0 text-clover" aria-hidden="true" />
          <div>
            <p className="display text-3xl not-italic">Paid — thank you</p>
            <p className="mt-1 text-chalk/75">
              {money(lastPayment?.amount_cents ?? invoice.total_cents)} received {invoice.paid_at ? dateTime(invoice.paid_at) : ''}
              {lastPayment ? ` · ${METHOD_LABEL[lastPayment.method] ?? lastPayment.method}` : ''}. A receipt is on its way.
            </p>
          </div>
        </section>
      )}
      {!paid && checkout === 'success' && (
        <p role="status" className="flex items-center gap-2 rounded-md border border-line bg-carbon-2 p-4 text-chalk/80">
          <Clock className="size-5 text-clover" aria-hidden="true" /> Payment received by Stripe — confirming. Refresh in a moment.
        </p>
      )}
      {!paid && checkout === 'cancelled' && <p role="status" className="rounded-md border border-line bg-carbon-2 p-4 text-chalk/80">Checkout cancelled. Nothing was charged.</p>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Card title="Itemized" padded={false}>
            <div className="divide-y divide-line">
              {lines.map((line) => <LineSummary key={line.id} line={line} showApproval={false} />)}
            </div>
            <div className="border-t border-line p-4 sm:p-5">
              <TotalsRows subtotal={invoice.subtotal_cents} tax={invoice.tax_cents} total={invoice.total_cents} taxLabel="Tax (parts)" discount={invoice.discount_cents} />
            </div>
          </Card>
          <Card title="Payments">
            {payments?.length ? (
              <ul className="divide-y divide-line">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span>
                      <span className="block font-semibold">{METHOD_LABEL[payment.method] ?? payment.method}</span>
                      <span className="block text-sm text-steel">{dateTime(payment.created_at)}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{money(payment.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-chalk/60">No payments yet.{invoice.due_at ? ` Due ${dateOnly(invoice.due_at)}.` : ''}</p>
            )}
          </Card>
        </div>

        <aside>
          {invoice.status === 'open' ? (
            <div id="pay" className="rounded-md border border-clover/40 bg-carbon-2 p-4 sm:p-6 lg:sticky lg:top-6">
              <p className="kicker">Pay online</p>
              <p className="display mt-2 text-4xl not-italic tabular-nums">{money(invoice.total_cents)}</p>
              {invoice.due_at && <p className="mt-1 text-sm text-steel">Due {dateOnly(invoice.due_at)}</p>}
              <div className="mt-5">
                <PayPanel invoiceId={invoice.id} totalCents={invoice.total_cents} stripeEnabled={Boolean(process.env.STRIPE_SECRET_KEY)} cardholder={viewer.profile.full_name} />
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-line bg-carbon-2 p-4 text-sm text-chalk/70 sm:p-6">
              Questions about this invoice? Call or text <a href={BUSINESS.smsHref} className="font-semibold text-clover">{BUSINESS.phoneDisplay}</a>.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
