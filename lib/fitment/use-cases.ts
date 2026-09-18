import { SERVICES } from '@/lib/site';

type ServiceId = (typeof SERVICES)[number]['id'];

/**
 * "What's it for?" — the second question the fitment tool asks, and the thing
 * that makes an answer useful instead of a filtered list.
 *
 * Borrowed in structure from the way wheel retailers tier fitment: each tier
 * states a promise and then the consequence of choosing it, in plain language,
 * so nobody has to already be an expert to choose. The axis here is *purpose*,
 * not aggression — every tier is street-legal, and there is deliberately no
 * "off-road only" tier, because in this trade that reads as an invitation to
 * remove emissions equipment. The taxonomy is the compliance position.
 */
export interface UseCase {
  id: string;
  /** ≤6 words. */
  name: string;
  promise: string;
  /** ≤40 words, plain English, states the trade-off honestly. */
  consequence: string;
  involves: readonly string[];
  services: readonly ServiceId[];
  /** Said on every tier, because every tier means it. */
  emissions: string;
}

export const USE_CASES: readonly UseCase[] = [
  {
    id: 'sorted',
    name: 'Stock & Sorted',
    promise: 'How it left the factory.',
    consequence:
      'We find the actual fault and fix that. No added power, so nothing downstream gets new stress. The cheapest path if the truck is simply not right.',
    involves: ['Full diagnostic scan and road test', 'Replace what failed, not what might', 'Written estimate before any work'],
    services: ['diagnostics', 'engine', 'maintenance'],
    emissions: 'Emissions equipment stays fitted and working.',
  },
  {
    id: 'tow',
    name: 'Tow Tuned',
    promise: 'Calibrated for weight and heat.',
    consequence:
      'Engine and transmission calibration aimed at towing: cooler exhaust temperatures and shifts that hold under load. Power goes up moderately. Best value per dollar if the truck works for a living.',
    involves: ['Engine and transmission calibration', 'Gauge or monitor so you can watch EGTs', 'Trans service if it has not had one'],
    services: ['tuning', 'transmission', 'diagnostics'],
    emissions: 'Emissions equipment stays fitted and working.',
  },
  {
    id: 'boost',
    name: 'Built for Boost',
    promise: 'Turbo, fuel and cooling.',
    consequence:
      'Hardware first, then a calibration to match it. Expect a build sheet, a lead time on parts, and a dyno pull before and after so the numbers are real.',
    involves: ['Turbo, injectors, CP3 or fuel supply', 'Cooling and intercooler to suit', 'Calibration matched to the hardware, on the dyno'],
    services: ['turbo', 'fuel', 'tuning'],
    emissions: 'Emissions equipment stays fitted and working.',
  },
];

export function findUseCase(id: string | null | undefined): UseCase | null {
  return USE_CASES.find((useCase) => useCase.id === id) ?? null;
}
