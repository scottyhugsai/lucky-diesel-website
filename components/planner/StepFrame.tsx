'use client';

import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { PLATFORMS } from '@/lib/site';
import type { StepId } from './options';
import type { Navigate } from './Planner';
import type { PlannerState } from './state';
import { STEP_ENTER } from './ui';

const SEGMENTS = ['Truck', 'Goal', 'Budget', 'Plan'] as const;
const SEGMENT_OF: Record<StepId, number> = { platform: 0, generation: 0, goal: 1, budget: 2, plan: 3 };
const PREVIOUS: Partial<Record<StepId, StepId>> = { generation: 'platform', goal: 'generation', budget: 'goal', plan: 'budget' };

function heading(state: PlannerState): string {
  switch (state.step) {
    case 'platform': return 'What are you building?';
    case 'generation': return `Which ${PLATFORMS.find((p) => p.id === state.platform)?.name ?? 'engine'}?`;
    case 'goal': return 'What’s the goal?';
    case 'budget': return 'Parts budget?';
    case 'plan': return 'Your plan';
  }
}

interface StepFrameProps {
  state: PlannerState;
  onNavigate: Navigate;
  children: React.ReactNode;
}

export function StepFrame({ state, onNavigate, children }: StepFrameProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(state.step);
  const segment = SEGMENT_OF[state.step];
  const previous = PREVIOUS[state.step];
  const isPlan = state.step === 'plan';

  useEffect(() => {
    // Keep initial page focus where the browser put it; move it on every step change after that.
    if (shownStep.current === state.step) return;
    shownStep.current = state.step;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [state.step]);

  return (
    <div className={`mx-auto px-4 pb-36 pt-24 sm:px-6 sm:pt-32 lg:pb-24 ${isPlan ? 'max-w-6xl' : 'max-w-2xl'}`}>
      <div className="flex min-h-12 items-center gap-3">
        {previous ? (
          <button
            type="button"
            onClick={() => onNavigate({ ...state, step: previous })}
            className="-ml-2 inline-flex size-12 shrink-0 items-center justify-center rounded-full text-chalk transition-colors hover:bg-gunmetal"
            aria-label="Back"
          >
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
        ) : (
          <span className="size-12 shrink-0 -ml-2" aria-hidden="true" />
        )}
        <nav aria-label="Planner progress" className="flex-1">
          <p className="sr-only">Step {segment + 1} of {SEGMENTS.length}: {SEGMENTS[segment]}</p>
          <ol className="grid grid-cols-4 gap-1.5" aria-hidden="true">
            {SEGMENTS.map((label, index) => (
              <li key={label} className="min-w-0">
                <span
                  className={`block h-1.5 origin-left -skew-x-[24deg] transition-colors duration-300 [[data-design=v2]_&]:skew-x-0 [[data-design=v2]_&]:rounded-full ${
                    index <= segment ? 'bg-clover' : 'bg-gunmetal'
                  }`}
                />
                <span className={`mt-2 block truncate text-[0.7rem] font-bold uppercase tracking-widest [[data-design=v2]_&]:text-xs [[data-design=v2]_&]:font-medium [[data-design=v2]_&]:normal-case [[data-design=v2]_&]:tracking-normal ${index === segment ? 'text-chalk' : 'text-steel'}`}>
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div key={state.step} className={`mt-8 sm:mt-12 ${STEP_ENTER}`}>
        <p className="kicker">Build planner</p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          style={{ outline: 'none' }}
          id="planner-heading"
          className="display mt-3 scroll-mt-28 text-5xl sm:text-7xl [[data-design=v2]_&]:text-4xl [[data-design=v2]_&]:sm:text-6xl"
        >
          {heading(state)}
        </h1>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
