'use client';

import { Pencil, Plus, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { buttonClass } from '@/components/app/ui';
import type { Tables } from '@/lib/db/database.types';
import { vehicleLabel } from '@/lib/format';
import { VehicleForm } from './VehicleForm';

const PLATFORM_LABEL: Record<string, string> = { duramax: 'Duramax', powerstroke: 'Powerstroke', cummins: 'Cummins', other: 'Other' };

export function TruckList({ customerId, vehicles, jobCounts }: { customerId: string; vehicles: Tables<'vehicles'>[]; jobCounts: Record<string, number> }) {
  const [editing, setEditing] = useState<string | 'new' | null>(vehicles.length ? null : 'new');

  return (
    <div className="grid gap-3">
      {vehicles.map((v) =>
        editing === v.id ? (
          <VehicleForm key={v.id} customerId={customerId} vehicle={v} onDone={() => setEditing(null)} />
        ) : (
          <article key={v.id} className="rounded-sm border border-line bg-carbon p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.65rem] font-bold uppercase tracking-widest text-clover">{v.platform ? PLATFORM_LABEL[v.platform] ?? v.platform : 'Platform not set'}</p>
                <h3 className="font-semibold leading-snug">{vehicleLabel(v)}{v.nickname && <span className="text-chalk/55"> “{v.nickname}”</span>}</h3>
                <p className="mt-0.5 break-all font-mono text-xs text-steel">{v.vin ?? 'No VIN'}</p>
              </div>
              <button type="button" onClick={() => setEditing(v.id)} className={`${buttonClass('ghost', 'sm')} !h-8 shrink-0`} aria-label={`Edit ${vehicleLabel(v)}`}>
                <Pencil className="size-4" aria-hidden="true" /> Edit
              </button>
            </div>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-chalk/65">
              {v.generation && <div className="flex gap-1"><dt className="text-steel">Gen</dt><dd>{v.generation}</dd></div>}
              {v.transmission && <div className="flex gap-1"><dt className="text-steel">Trans</dt><dd>{v.transmission}</dd></div>}
              {v.mileage && <div className="flex gap-1"><dt className="text-steel">Miles</dt><dd className="tabular-nums">{v.mileage.toLocaleString('en-US')}</dd></div>}
              <div className="flex gap-1"><dt className="text-steel">Jobs</dt><dd>{jobCounts[v.id] ?? 0}</dd></div>
            </dl>
            <Link href={`/admin/jobs/new?customer=${customerId}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-clover hover:underline">
              <Wrench className="size-3.5" aria-hidden="true" /> Start a job
            </Link>
          </article>
        ),
      )}
      {editing === 'new' ? (
        <VehicleForm customerId={customerId} onDone={() => setEditing(null)} />
      ) : (
        <button type="button" onClick={() => setEditing('new')} className={`${buttonClass('secondary', 'sm')} justify-self-start`}>
          <Plus className="size-4" aria-hidden="true" /> Add truck
        </button>
      )}
    </div>
  );
}
