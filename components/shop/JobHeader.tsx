import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { StatusPill } from '@/components/app/ui';
import type { Enums } from '@/lib/db/database.types';
import { dateTime } from '@/lib/format';

interface JobHeaderProps {
  number: number;
  title: string;
  status: Enums<'work_order_status'>;
  truck: string;
  engine: string | null;
  nickname: string | null;
  vin: string | null;
  mileageIn: number | null;
  complaint: string | null;
  customerFirstName: string;
  bay: string | null;
  promisedAt: string | null;
  techName: string | null;
}

function Spec({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] font-semibold uppercase tracking-widest text-steel">{label}</dt>
      <dd className={`mt-0.5 truncate font-semibold text-chalk ${mono ? 'font-mono text-[0.95rem] tracking-wide' : ''}`}>{children}</dd>
    </div>
  );
}

export function JobHeader(props: JobHeaderProps) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <Link href="/shop" className="inline-flex h-11 w-fit items-center gap-2 rounded-sm pr-3 text-sm font-semibold text-steel hover:text-chalk">
        <ArrowLeft className="size-4" aria-hidden="true" /> My jobs
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-sm font-semibold tracking-wider text-clover">WO #{props.number}</p>
          <StatusPill status={props.status} />
        </div>
        <h1 className="display mt-3 text-5xl sm:text-6xl">{props.truck}</h1>
        <p className="mt-2 text-lg text-chalk/80">
          {props.engine && <strong className="text-chalk">{props.engine}</strong>}
          {props.engine && ' · '}
          {props.title}
          {props.nickname && <span className="text-steel"> · “{props.nickname}”</span>}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-line bg-carbon-2 p-4 sm:grid-cols-4">
        <div className="col-span-2">
          <Spec label="VIN" mono>{props.vin ?? 'Not recorded'}</Spec>
        </div>
        <Spec label="Mileage in">{props.mileageIn != null ? `${props.mileageIn.toLocaleString('en-US')} mi` : '—'}</Spec>
        <Spec label="Customer">{props.customerFirstName || '—'}</Spec>
        <Spec label="Bay · Tech">{[props.bay, props.techName].filter(Boolean).join(' · ') || 'Unassigned'}</Spec>
        <Spec label="Promised">{props.promisedAt ? dateTime(props.promisedAt) : '—'}</Spec>
      </dl>

      {props.complaint && (
        <blockquote className="border-l-4 border-clover bg-clover/5 py-3 pl-4 pr-3">
          <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-steel">Customer complaint</p>
          <p className="mt-1 text-chalk/90">{props.complaint}</p>
        </blockquote>
      )}
    </header>
  );
}
