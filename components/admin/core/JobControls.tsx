'use client';

import { Banknote, FileText, Send } from 'lucide-react';
import Link from 'next/link';
import { changeStatus, createInvoiceForJob, sendEstimate } from '@/app/admin/jobs/[id]/actions';
import { recordCounterPayment } from '@/app/admin/invoices/actions';
import { fieldClass } from '@/components/app/ui';
import type { Enums } from '@/lib/db/database.types';
import { NEXT_STATUSES, WORK_ORDER_STATUS, money } from '@/lib/format';
import { ActionForm, PendingButton } from './ActionForm';

type Status = Enums<'work_order_status'>;

interface JobControlsProps {
  workOrderId: string;
  status: Status;
  pendingLines: number;
  approvedLines: number;
  invoice: { id: string; number: number; status: Enums<'invoice_status'>; total_cents: number } | null;
}

const INVOICEABLE: Status[] = ['in_progress', 'quality_check', 'ready'];

export function PaymentForm({ invoiceId, totalCents }: { invoiceId: string; totalCents: number }) {
  return (
    <ActionForm action={recordCounterPayment} className="grid gap-2" confirm={`Record ${money(totalCents)} paid at the counter?`}>
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <p className="text-sm text-chalk/70">Collect <span className="font-bold text-chalk">{money(totalCents)}</span> at the counter:</p>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`method-${invoiceId}`}>Method</label>
        <select id={`method-${invoiceId}`} name="method" defaultValue="cash" className={`${fieldClass} h-10 flex-1 text-sm`}>
          <option value="cash">Cash</option>
          <option value="check">Check</option>
        </select>
        <PendingButton size="sm" className="!h-10">
          <Banknote className="size-4" aria-hidden="true" /> Record payment
        </PendingButton>
      </div>
    </ActionForm>
  );
}

export function JobControls({ workOrderId, status, pendingLines, approvedLines, invoice }: JobControlsProps) {
  const next = NEXT_STATUSES[status].filter((s) => s !== 'invoiced' && s !== 'paid');
  // Estimates go to the customer through “Send estimate”, which also sends the approval link.
  const moves = next.filter((s) => s !== 'cancelled' && !(status === 'estimate' && s === 'awaiting_approval'));
  const canSend = status === 'estimate' && pendingLines > 0;
  const canInvoice = !invoice && INVOICEABLE.includes(status) && approvedLines > 0;

  return (
    <div className="grid gap-4">
      {canSend && (
        <ActionForm action={sendEstimate} className="rounded-sm border border-clover/40 bg-clover/5 p-3">
          <input type="hidden" name="work_order_id" value={workOrderId} />
          <p className="mb-2 text-sm text-chalk/75">{pendingLines} line{pendingLines === 1 ? '' : 's'} ready for the customer to approve.</p>
          <PendingButton className="w-full"><Send className="size-4" aria-hidden="true" /> Send estimate for approval</PendingButton>
        </ActionForm>
      )}

      {canInvoice && (
        <ActionForm action={createInvoiceForJob} className="rounded-sm border border-clover/40 bg-clover/5 p-3" confirm="Freeze the approved lines into an invoice and text the customer their pay link?">
          <input type="hidden" name="work_order_id" value={workOrderId} />
          <p className="mb-2 text-sm text-chalk/75">Job done? Invoice the {approvedLines} approved line{approvedLines === 1 ? '' : 's'}.</p>
          <PendingButton className="w-full"><FileText className="size-4" aria-hidden="true" /> Create invoice</PendingButton>
        </ActionForm>
      )}
      {!invoice && INVOICEABLE.includes(status) && approvedLines === 0 && (
        <p className="text-sm text-amber-300">No approved lines yet, so there is nothing to invoice.</p>
      )}

      {invoice && (
        <div className="rounded-sm border border-line bg-carbon p-3">
          <p className="flex items-center justify-between gap-2 text-sm">
            <Link href={`/admin/invoices/${invoice.id}`} className="font-semibold text-clover hover:underline">Invoice #{invoice.number}</Link>
            <span className={`font-bold uppercase tracking-wider ${invoice.status === 'paid' ? 'text-clover' : 'text-amber-300'}`}>{invoice.status}</span>
          </p>
          {invoice.status === 'open' && <div className="mt-3"><PaymentForm invoiceId={invoice.id} totalCents={invoice.total_cents} /></div>}
        </div>
      )}

      {next.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-steel">Move to</p>
          <div className="flex flex-wrap items-start gap-2">
            {moves.length > 0 && (
              <ActionForm action={changeStatus} aria-label="Change status" className="flex flex-wrap gap-2">
                <input type="hidden" name="work_order_id" value={workOrderId} />
                {moves.map((to) => (
                  <PendingButton key={to} name="to" value={to} size="sm" variant="secondary">
                    {WORK_ORDER_STATUS[to].label}
                  </PendingButton>
                ))}
              </ActionForm>
            )}
            {next.includes('cancelled') && (
              <ActionForm action={changeStatus} aria-label="Cancel job" confirm="Cancel this job? Scheduled customer messages for it will be skipped.">
                <input type="hidden" name="work_order_id" value={workOrderId} />
                <PendingButton name="to" value="cancelled" size="sm" variant="danger">Cancel job</PendingButton>
              </ActionForm>
            )}
          </div>
        </div>
      ) : (
        status === 'paid' && <p className="text-sm text-clover">Paid in full. This job is closed.</p>
      )}
    </div>
  );
}
