'use client';

import { PLATFORMS, type Platform } from '@/lib/site';
import { useStore } from './CartProvider';
import { FIELD } from './styles';

const SELECT = `min-h-12 w-full border border-line bg-carbon px-3 text-chalk ${FIELD}`;

/** Compact platform + generation selects bound to the saved truck. */
export function TruckSelect({ idPrefix }: { idPrefix: string }) {
  const { truck, setTruck } = useStore();
  const platform = PLATFORMS.find((p) => p.id === truck?.platform);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <label htmlFor={`${idPrefix}-platform`} className="sr-only">Platform</label>
        <select
          id={`${idPrefix}-platform`}
          value={truck?.platform ?? ''}
          onChange={(event) => {
            const id = event.target.value as Platform['id'] | '';
            setTruck(id ? { platform: id, generationCollection: null } : null);
          }}
          className={SELECT}
        >
          <option value="">Select platform</option>
          {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-gen`} className="sr-only">Generation</label>
        <select
          id={`${idPrefix}-gen`}
          value={truck?.generationCollection ?? ''}
          disabled={!platform}
          onChange={(event) => platform && setTruck({ platform: platform.id, generationCollection: event.target.value || null })}
          className={`${SELECT} disabled:opacity-50`}
        >
          <option value="">Select generation</option>
          {platform?.generations.map((name, i) => <option key={name} value={platform.generationCollections[i]}>{name}</option>)}
        </select>
      </div>
    </div>
  );
}
