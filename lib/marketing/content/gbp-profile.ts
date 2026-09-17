import type { Closure } from './seo-local';

/**
 * The Google Business Profile record the owner keeps in the app: description,
 * category, services and holiday hours. Pure helpers for the completeness
 * audit and for the patch body we send once Google is connected.
 */

export interface GbpProfileFields {
  description: string | null;
  primaryCategory: string | null;
  /** One service per line. */
  services: string | null;
  hoursNote: string | null;
}

/** Google truncates the description in search; aim for a real paragraph. */
export const DESCRIPTION_MIN = 200;
export const DESCRIPTION_MAX = 750;
export const SERVICES_MIN = 4;

export function serviceList(services: string | null): string[] {
  return (services ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export interface ProfileAudit {
  ok: boolean;
  issues: string[];
  done: number;
  total: number;
}

/** What is still missing from the profile. Four checks, so the panel can show progress. */
export function auditProfile(fields: GbpProfileFields, closures: readonly Closure[] = []): ProfileAudit {
  const description = (fields.description ?? '').trim();
  const services = serviceList(fields.services);
  const checks: { ok: boolean; issue: string }[] = [
    { ok: description.length >= DESCRIPTION_MIN, issue: description ? `Description is ${description.length} of ${DESCRIPTION_MIN} characters.` : 'Add a shop description.' },
    { ok: Boolean(fields.primaryCategory?.trim()), issue: 'Set the primary category.' },
    { ok: services.length >= SERVICES_MIN, issue: `List at least ${SERVICES_MIN} services (${services.length} now).` },
    { ok: closures.length > 0 || Boolean(fields.hoursNote?.trim()), issue: 'Add holiday hours or an hours note.' },
  ];
  const issues = checks.filter((c) => !c.ok).map((c) => c.issue);
  return { ok: issues.length === 0, issues, done: checks.length - issues.length, total: checks.length };
}

interface GoogleDate {
  year: number;
  month: number;
  day: number;
}

function googleDate(day: string): GoogleDate {
  const [year, month, date] = day.split('-').map(Number);
  return { year, month, day: date };
}

export interface SpecialHourPeriod {
  startDate: GoogleDate;
  endDate: GoogleDate;
  closed: boolean;
}

/** Special-hour periods for Google, one per closure that is a full-day closure. */
export function specialHourPeriods(closures: readonly Closure[]): SpecialHourPeriod[] {
  return closures
    .filter((c) => c.closed)
    .map((c) => ({ startDate: googleDate(c.startsOn), endDate: googleDate(c.endsOn), closed: true }));
}

export interface ProfilePatch {
  updateMask: string[];
  body: Record<string, unknown>;
}

/**
 * The patch we send to the Business Information API. Only fields we really
 * hold: the description and holiday closures. Category and address stay with
 * the owner because Google validates them against its own taxonomy.
 */
export function profilePatch(fields: GbpProfileFields, closures: readonly Closure[]): ProfilePatch {
  const description = (fields.description ?? '').trim().slice(0, DESCRIPTION_MAX);
  const periods = specialHourPeriods(closures);
  const updateMask: string[] = [];
  const body: Record<string, unknown> = {};
  if (description) {
    updateMask.push('profile.description');
    body.profile = { description };
  }
  updateMask.push('specialHours');
  body.specialHours = { specialHourPeriods: periods };
  return { updateMask, body };
}
