'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { useStore } from '@/components/store/CartProvider';
import { BudgetStep, GoalStep } from './PreferenceSteps';
import type { PlannerProduct } from './product';
import { PlanStep } from './PlanStep';
import { parsePlannerState, plannerQuery, type PlannerState } from './state';
import { StepFrame } from './StepFrame';
import { GenerationStep, PlatformStep } from './TruckSteps';

export interface PlannerProps {
  /** Platform the server pre-filtered `products` for (null before a platform is picked). */
  productsPlatform: PlannerState['platform'];
  products: PlannerProduct[];
  catalogOk: boolean;
  /** Parts listed per generation collection handle, for the chosen platform. */
  generationCounts: Record<string, number>;
}

export type Navigate = (next: PlannerState, options?: { replace?: boolean }) => void;

export function Planner({ productsPlatform, products, catalogOk, generationCounts }: PlannerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useMemo(() => parsePlannerState(searchParams), [searchParams]);
  const { truck, setTruck } = useStore();

  const navigate = useCallback<Navigate>((next, options = {}) => {
    const url = `/build-planner${plannerQuery(next)}`;
    // A new platform needs a fresh, server-filtered catalog; everything else is instant.
    if (next.platform !== productsPlatform) {
      if (options.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
      return;
    }
    if (options.replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
  }, [productsPlatform, router]);

  // Browser back/forward across a platform change: re-sync the server-filtered catalog.
  useEffect(() => {
    if (state.platform && state.platform !== productsPlatform) router.refresh();
  }, [state.platform, productsPlatform, router]);

  const isStale = state.platform !== null && state.platform !== productsPlatform;

  return (
    <StepFrame state={state} onNavigate={navigate}>
      {state.step === 'platform' && <PlatformStep state={state} savedTruck={truck} onNavigate={navigate} />}
      {state.step === 'generation' && (
        <GenerationStep state={state} counts={isStale ? null : generationCounts} onNavigate={navigate} onSaveTruck={setTruck} />
      )}
      {state.step === 'goal' && <GoalStep state={state} onNavigate={navigate} />}
      {state.step === 'budget' && <BudgetStep state={state} onNavigate={navigate} />}
      {state.step === 'plan' && (
        <PlanStep state={state} products={isStale ? null : products} catalogOk={catalogOk} onNavigate={navigate} />
      )}
    </StepFrame>
  );
}
