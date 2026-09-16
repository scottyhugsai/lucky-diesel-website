/** Service type from a job title, for revenue-mix reporting. First match wins, so specific terms come first. */

const RULES: readonly (readonly [label: string, pattern: RegExp])[] = [
  ['Transmission', /\b(trans(mission)?|tcm|allison|10r140|68rfe)\b/i],
  ['Head studs', /\bhead ?stud/i],
  ['CP3', /\bcp3\b/i],
  ['Turbo', /\bturbo/i],
  ['Injectors', /\binjector/i],
  ['Exhaust', /\bexhaust|downpipe/i],
  ['Tune', /\btun(e|ing)\b|ez-?lynk|calibration/i],
  ['Maintenance', /\bmaintenance|oil|service\b|filter/i],
  ['Diagnostic', /\bdiag/i],
];

export const SERVICE_TYPES = [...RULES.map(([label]) => label), 'Other'] as const;

export function serviceTypeFor(title: string | null | undefined): string {
  if (!title) return 'Other';
  return RULES.find(([, pattern]) => pattern.test(title))?.[0] ?? 'Other';
}
