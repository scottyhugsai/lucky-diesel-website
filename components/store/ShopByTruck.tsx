'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { PLATFORMS, type Platform } from '@/lib/site';
import { useStore } from './CartProvider';
import { productsHref, truckLabel } from './listing';
import { PILL, TILE } from './styles';

/** Platform → generation picker. Choosing a generation saves the truck and opens matching parts. */
export function ShopByTruck() {
  const router = useRouter();
  const { truck, setTruck } = useStore();
  const [platformId, setPlatformId] = useState<Platform['id'] | null>(null);
  const active = PLATFORMS.find((p) => p.id === (platformId ?? truck?.platform));

  const choose = (platform: Platform, generationCollection: string) => {
    setTruck({ platform: platform.id, generationCollection });
    router.push(productsHref({ platform: platform.id, gen: generationCollection }));
  };

  return (
    <div>
      <div role="group" aria-label="Engine platform" className="grid grid-cols-3 gap-2 sm:gap-3">
        {PLATFORMS.map((platform) => {
          const isOn = active?.id === platform.id;
          return (
            <button
              key={platform.id}
              type="button"
              aria-pressed={isOn}
              onClick={() => setPlatformId(platform.id)}
              className={`flex min-h-20 min-w-0 flex-col items-start justify-end gap-1 border px-2.5 py-3 text-left transition-colors sm:min-h-28 sm:p-5 ${TILE} ${
                isOn ? 'border-clover bg-clover/10' : 'border-line bg-carbon-2 hover:border-chalk/30'
              }`}
            >
              <span className="text-xs text-steel sm:text-sm">{platform.make}</span>
              <span className="display max-w-full text-lg not-italic sm:text-4xl [[data-design=v2]_&]:text-base sm:[[data-design=v2]_&]:text-3xl">{platform.name}</span>
            </button>
          );
        })}
      </div>

      {active ? (
        <fieldset className="mt-4">
          <legend className="text-sm text-steel">Pick your {active.name} generation</legend>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {active.generations.map((name, index) => {
              const collection = active.generationCollections[index] ?? '';
              const isSaved = truck?.generationCollection === collection;
              return (
                <li key={collection}>
                  <button
                    type="button"
                    onClick={() => choose(active, collection)}
                    className={`group flex min-h-12 w-full items-center justify-between gap-3 border px-4 py-3 text-left font-semibold tabular-nums transition-colors ${PILL} ${
                      isSaved ? 'border-clover text-clover' : 'border-line hover:border-clover hover:text-clover'
                    }`}
                  >
                    {name}
                    <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : (
        <p className="mt-4 text-sm text-steel">Choose a platform to see generations.</p>
      )}

      {truck && (
        <p className="mt-5 text-sm text-chalk/70" aria-live="polite">
          Saved truck: <strong className="text-chalk">{truckLabel(truck)}</strong> ·{' '}
          <Link href={productsHref({ platform: truck.platform, gen: truck.generationCollection })} className="font-semibold text-clover underline-offset-4 hover:underline">
            Shop parts for it
          </Link>
        </p>
      )}
    </div>
  );
}
