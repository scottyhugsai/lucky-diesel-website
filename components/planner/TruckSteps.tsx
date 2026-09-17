'use client';

import { ArrowRight, History } from 'lucide-react';
import { useState } from 'react';
import type { TruckSelection } from '@/lib/store/normalize';
import { BUSINESS, PLATFORMS } from '@/lib/site';
import { ChoiceGroup } from './ChoiceGroup';
import type { Navigate } from './Planner';
import { truckLabel, type PlannerState } from './state';
import { BTN_GHOST, BTN_PRIMARY, INPUT } from './ui';

const PICK_DELAY_MS = 180;

type PlatformId = (typeof PLATFORMS)[number]['id'];

interface PlatformStepProps {
  state: PlannerState;
  savedTruck: TruckSelection | null;
  onNavigate: Navigate;
}

export function PlatformStep({ state, savedTruck, onNavigate }: PlatformStepProps) {
  const [platform, setPlatform] = useState<PlatformId | null>(state.platform);
  const saved = savedTruck?.generationCollection
    && PLATFORMS.find((p) => p.id === savedTruck.platform)?.generationCollections.includes(savedTruck.generationCollection)
    ? { platform: savedTruck.platform, gen: savedTruck.generationCollection }
    : null;

  const next = (id: PlatformId) => onNavigate({ ...state, platform: id, gen: id === state.platform ? state.gen : null, picks: {}, step: 'generation' });

  return (
    <div className="grid gap-6">
      {saved && !state.platform && (
        <button
          type="button"
          onClick={() => onNavigate({ ...state, ...saved, picks: {}, step: 'goal' })}
          className={`${BTN_GHOST} min-h-14 justify-between border-clover/40 text-left`}
        >
          <span className="flex items-center gap-3">
            <History className="size-5 text-clover" aria-hidden="true" />
            <span>Use my truck: <strong className="font-semibold">{truckLabel(saved)}</strong></span>
          </span>
          <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
        </button>
      )}
      <ChoiceGroup
        name="platform"
        value={platform}
        onChange={setPlatform}
        onPick={(id) => window.setTimeout(() => next(id), PICK_DELAY_MS)}
        choices={PLATFORMS.map((p) => ({ value: p.id, label: p.name, hint: p.make }))}
      />
      <button type="button" disabled={!platform} onClick={() => platform && next(platform)} className={`${BTN_PRIMARY} w-full sm:w-auto sm:justify-self-start`}>
        Continue <ArrowRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

interface GenerationStepProps {
  state: PlannerState;
  counts: Record<string, number> | null;
  onNavigate: Navigate;
  onSaveTruck: (truck: TruckSelection) => void;
}

export function GenerationStep({ state, counts, onNavigate, onSaveTruck }: GenerationStepProps) {
  const platform = PLATFORMS.find((p) => p.id === state.platform);
  const [gen, setGen] = useState<string | null>(state.gen);
  const [miles, setMiles] = useState(state.miles);
  if (!platform) return null;

  const choices = platform.generationCollections.map((handle, index) => {
    const count = counts?.[handle];
    return {
      value: handle,
      label: platform.generations[index] ?? handle,
      meta: count === undefined ? undefined : count ? `${count} part${count === 1 ? '' : 's'}` : 'Ask us',
    };
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gen || !platform) return;
    onSaveTruck({ platform: platform.id, generationCollection: gen });
    onNavigate({ ...state, gen, miles: miles.replace(/\D/g, ''), picks: gen === state.gen ? state.picks : {}, step: 'goal' });
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <ChoiceGroup name="generation" value={gen} onChange={setGen} choices={choices} />
      <div>
        <label htmlFor="planner-miles" className="mb-2 flex items-baseline justify-between text-sm font-semibold text-chalk/85">
          Mileage <span className="text-xs font-normal text-steel">Optional</span>
        </label>
        <input
          id="planner-miles"
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 85000"
          maxLength={7}
          value={miles}
          onChange={(event) => setMiles(event.target.value.replace(/\D/g, ''))}
          className={INPUT}
        />
      </div>
      <button type="submit" disabled={!gen} className={`${BTN_PRIMARY} w-full sm:w-auto sm:justify-self-start`}>
        Continue <ArrowRight className="size-5" aria-hidden="true" />
      </button>
      <p className="text-sm text-steel">
        Not sure which one? Text a photo of your door sticker to{' '}
        <a href={BUSINESS.smsHref} className="font-semibold text-chalk underline underline-offset-4">{BUSINESS.phoneDisplay}</a>.
      </p>
    </form>
  );
}
