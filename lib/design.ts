import 'server-only';
import { cookies } from 'next/headers';

export const DESIGNS = ['v1', 'v2'] as const;
export type Design = (typeof DESIGNS)[number];
export const DESIGN_COOKIE = 'ld_design';

export const DESIGN_LABELS: Record<Design, string> = { v1: 'Garage', v2: 'Showroom' };

export function isDesign(value: unknown): value is Design {
  return typeof value === 'string' && (DESIGNS as readonly string[]).includes(value);
}

/** Which public-site design this visitor is viewing. Defaults to the original (v1). */
export async function getDesign(): Promise<Design> {
  const value = (await cookies()).get(DESIGN_COOKIE)?.value;
  return isDesign(value) ? value : 'v1';
}
