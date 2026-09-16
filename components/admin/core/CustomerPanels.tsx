import Link from 'next/link';
import { Badge, StatusPill } from '@/components/app/ui';
import { dateOnly, money } from '@/lib/format';
import { computeTotals } from '@/lib/work-orders/totals';
import type { CustomerDetail } from './customers-data';

export function SmsBadge({ status }: { status: 'consented' | 'opted_out' | 'none' }) {
  if (status === 'consented') return <Badge tone="good">SMS OK</Badge>;
  if (status === 'opted_out') return <Badge tone="bad">Opted out</Badge>;
  return <Badge>No consent</Badge>;
}

export function JobHistory({ jobs, taxRate }: { jobs: CustomerDetail['jobs']; taxRate: number }) {
  if (!jobs.length) return <p className="text-sm text-steel">No jobs yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {jobs.map((job) => (
        <li key={job.id}>
          <Link href={`/admin/jobs/${job.id}`} className="-mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm px-2 py-2.5 hover:bg-gunmetal">
            <span className="display w-14 text-lg not-italic text-clover">#{job.number}</span>
            <span className="min-w-0 flex-1 basis-40">
              <span className="block truncate font-semibold">{job.title}</span>
              <span className="block text-xs text-steel">{dateOnly(job.created_at)}</span>
            </span>
            <StatusPill status={job.status} />
            <span className="w-24 text-right font-bold tabular-nums">{money(computeTotals(job.line_items.filter((l) => l.approval !== 'declined'), taxRate).totalCents, { whole: true })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function InvoiceHistory({ invoices }: { invoices: CustomerDetail['invoices'] }) {
  if (!invoices.length) return <p className="text-sm text-steel">No invoices yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {invoices.map((inv) => (
        <li key={inv.id}>
          <Link href={`/admin/invoices/${inv.id}`} className="-mx-2 flex items-center gap-3 rounded-sm px-2 py-2.5 text-sm hover:bg-gunmetal">
            <span className="font-semibold">#{inv.number}</span>
            <span className="flex-1 text-steel">{dateOnly(inv.created_at)}</span>
            <Badge tone={inv.status === 'paid' ? 'good' : inv.status === 'void' ? 'neutral' : 'warn'}>{inv.status}</Badge>
            <span className="w-20 text-right font-bold tabular-nums">{money(inv.total_cents, { whole: true })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const LEAD_TONE = { new: 'info', contacted: 'neutral', booked: 'violet', won: 'good', lost: 'bad' } as const;

export function LeadHistory({ leads }: { leads: CustomerDetail['leads'] }) {
  if (!leads.length) return <p className="text-sm text-steel">No web or social leads from this customer.</p>;
  return (
    <ul className="grid gap-3">
      {leads.map((lead) => (
        <li key={lead.id} className="text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{lead.service_label ?? 'Service request'}</span>
            <Badge tone={LEAD_TONE[lead.status]}>{lead.status}</Badge>
            <span className="ml-auto text-xs text-steel">{lead.source} · {dateOnly(lead.created_at)}</span>
          </p>
          {(lead.platform_label || lead.details) && <p className="mt-0.5 line-clamp-2 text-chalk/65">{[lead.platform_label, lead.details].filter(Boolean).join(' — ')}</p>}
        </li>
      ))}
    </ul>
  );
}
