import Link from 'next/link';
import { MessageSquareText, Receipt } from 'lucide-react';
import { Badge, Card } from '@/components/app/ui';
import type { Enums, Tables } from '@/lib/db/database.types';
import { dateTime, money, WORK_ORDER_STATUS } from '@/lib/format';

interface JobSidebarProps {
  job: Tables<'work_orders'>;
  techName: string | null;
  invoice: { id: string; number: number; status: Enums<'invoice_status'>; total_cents: number } | null;
  notes: { id: string; body: string; created_at: string }[];
  events: { id: string; to_status: Enums<'work_order_status'>; note: string | null; created_at: string }[];
}

export function JobSidebar({ job, techName, invoice, notes, events }: JobSidebarProps) {
  const details: [string, string][] = [
    ...(job.completed_at ? [] : [['Promised', job.promised_at ? dateTime(job.promised_at) : 'We’ll confirm'] as [string, string]]),
    ['Technician', techName ?? 'Being assigned'],
    ['Mileage in', job.mileage_in ? job.mileage_in.toLocaleString('en-US') : '—'],
    ['Opened', dateTime(job.created_at)],
  ];
  if (job.completed_at) details.push(['Finished', dateTime(job.completed_at)]);

  return (
    <aside className="space-y-6">
      {invoice && (
        <Link href={`/portal/invoices/${invoice.id}`} className="flex min-h-16 items-center gap-3 rounded-md border border-line bg-carbon-2 p-4 transition-colors hover:border-clover/50">
          <Receipt className="size-5 text-clover" aria-hidden="true" />
          <span className="flex-1">
            <span className="block font-semibold">Invoice #{invoice.number}</span>
            <span className="block text-sm text-chalk/60 tabular-nums">{money(invoice.total_cents)}</span>
          </span>
          <Badge tone={invoice.status === 'paid' ? 'good' : invoice.status === 'open' ? 'warn' : 'neutral'}>{invoice.status === 'open' ? 'Due' : invoice.status}</Badge>
        </Link>
      )}

      <Card title="Details">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
          {details.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-steel">{label}</dt>
              <dd className="text-right font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {notes.length > 0 && (
        <Card title="From the shop">
          <ul className="space-y-4">
            {notes.map((note) => (
              <li key={note.id} className="flex gap-3">
                <MessageSquareText className="mt-0.5 size-4 shrink-0 text-clover" aria-hidden="true" />
                <div>
                  <p className="text-chalk/85">{note.body}</p>
                  <p className="mt-1 text-xs text-steel">{dateTime(note.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {events.length > 0 && (
        <Card title="History">
          <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
            {events.map((event, index) => (
              <li key={event.id} className="relative pl-6">
                <span className={`absolute left-0 top-1.5 size-[11px] rounded-full border-2 ${index === 0 ? 'border-clover bg-clover' : 'border-steel/60 bg-carbon-2'}`} aria-hidden="true" />
                <p className="font-semibold">{WORK_ORDER_STATUS[event.to_status].customerLabel}</p>
                {event.note && <p className="text-sm text-chalk/65">{event.note}</p>}
                <p className="text-xs text-steel">{dateTime(event.created_at)}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </aside>
  );
}
