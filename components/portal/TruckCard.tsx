import Link from 'next/link';
import { ChevronRight, Gauge } from 'lucide-react';
import type { Tables } from '@/lib/db/database.types';

interface TruckCardProps {
  vehicle: Tables<'vehicles'>;
  horsepower: number | null;
  torque: number | null;
}

export function TruckCard({ vehicle, horsepower, torque }: TruckCardProps) {
  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return (
    <Link
      href={`/portal/trucks/${vehicle.id}`}
      className="group relative flex flex-col overflow-hidden rounded-md border border-line bg-carbon-2 p-4 transition-colors hover:border-clover/50 focus-visible:border-clover sm:p-5"
    >
      <span className="grain pointer-events-none absolute inset-0" aria-hidden="true" />
      <span className="relative flex items-start justify-between gap-3">
        <span className="min-w-0">
          {vehicle.nickname && <span className="kicker block text-[0.8rem]">“{vehicle.nickname}”</span>}
          <span className="display mt-1 block text-3xl not-italic leading-none">{title || 'Your truck'}</span>
          <span className="mt-2 block text-sm text-chalk/60">
            {[vehicle.engine_code, vehicle.transmission].filter(Boolean).join(' · ')}
          </span>
        </span>
        <ChevronRight className="mt-1 size-5 shrink-0 text-steel transition-transform group-hover:translate-x-0.5 group-hover:text-clover" aria-hidden="true" />
      </span>
      <span className="relative mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-widest text-steel">Mileage</span>
          <span className="display mt-1 block text-2xl not-italic tabular-nums">{vehicle.mileage ? vehicle.mileage.toLocaleString('en-US') : '—'}</span>
        </span>
        <span>
          <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-steel">
            <Gauge className="size-3.5" aria-hidden="true" /> Dyno
          </span>
          <span className="display mt-1 block text-2xl not-italic tabular-nums text-clover">
            {horsepower ? `${horsepower} hp` : '—'}
          </span>
          {torque && <span className="block text-xs text-chalk/55 tabular-nums">{torque} lb-ft</span>}
        </span>
      </span>
    </Link>
  );
}
