import 'server-only';
import { PLATFORMS } from '@/lib/site';

export type PlatformId = 'duramax' | 'powerstroke' | 'cummins' | 'other';

export interface DecodedVin {
  year: number | null;
  make: string | null;
  model: string | null;
  engineCode: string | null;
  transmission: string | null;
  platform: PlatformId;
  generation: string | null;
  fuel: string | null;
  warning: string | null;
}

const NHTSA_TIMEOUT_MS = 8000;

/** Picks the diesel platform from what vPIC reports. Non-diesels are "other". */
export function guessPlatform(input: { make?: string | null; engine?: string | null; fuel?: string | null; displacement?: string | null; manufacturer?: string | null }): PlatformId {
  const make = (input.make ?? '').toLowerCase();
  const engine = `${input.engine ?? ''} ${input.manufacturer ?? ''}`.toLowerCase();
  const isDiesel = /diesel/i.test(input.fuel ?? '') || /duramax|power ?stroke|cummins/.test(engine);
  if (/duramax/.test(engine) || ((make === 'chevrolet' || make === 'gmc') && (isDiesel || input.displacement === '6.6'))) return isDiesel ? 'duramax' : 'other';
  if (/power ?stroke/.test(engine) || (make === 'ford' && isDiesel)) return 'powerstroke';
  if (/cummins/.test(engine) || ((make === 'ram' || make === 'dodge') && isDiesel)) return 'cummins';
  return 'other';
}

/** Generation label from lib/site PLATFORMS, e.g. 2021 Duramax → "2017–Present L5P 6.6L". */
export function guessGeneration(platform: PlatformId, year: number | null): string | null {
  if (!year || platform === 'other') return null;
  const generations = PLATFORMS.find((p) => p.id === platform)?.generations ?? [];
  for (const label of generations) {
    const match = /^(\d{4})(?:\.5)?–(\d{4}|Present)/.exec(label);
    if (!match) continue;
    const from = Number(match[1]);
    const to = match[2] === 'Present' ? 9999 : Number(match[2]);
    if (year >= from && year <= to) return label;
  }
  return null;
}

const title = (value: string | null) =>
  value && value === value.toUpperCase() && value.length > 3 ? value.charAt(0) + value.slice(1).toLowerCase() : value;

/** Decodes a VIN with the free NHTSA vPIC API. Returns an error string instead of throwing. */
export async function decodeVinWithNhtsa(vin: string): Promise<{ data: DecodedVin } | { error: string }> {
  let response: Response;
  try {
    response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`, {
      signal: AbortSignal.timeout(NHTSA_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch {
    return { error: 'The NHTSA VIN service didn’t respond. Enter the truck details by hand, or try again in a minute.' };
  }
  if (!response.ok) return { error: `The NHTSA VIN service returned ${response.status}. Enter the details by hand.` };

  const payload = (await response.json().catch(() => null)) as { Results?: Record<string, string | null>[] } | null;
  const row = payload?.Results?.[0];
  if (!row || !row.Make) return { error: 'NHTSA couldn’t decode that VIN. Double-check the 17 characters.' };

  const get = (key: string) => (row[key] ?? '').trim() || null;
  const year = Number(get('ModelYear')) || null;
  const engineModel = get('EngineModel');
  const platform = guessPlatform({ make: get('Make'), engine: engineModel, fuel: get('FuelTypePrimary'), displacement: get('DisplacementL'), manufacturer: get('EngineManufacturer') });
  const displacement = get('DisplacementL');
  const errorCode = get('ErrorCode') ?? '0';

  return {
    data: {
      year,
      make: title(get('Make')),
      model: [get('Model'), get('Series')].filter(Boolean).join(' ') || null,
      engineCode: engineModel?.split(/\s+-\s+|,/)[0]?.trim() || (displacement ? `${Number(displacement).toFixed(1)}L` : null),
      transmission: get('TransmissionStyle'),
      platform,
      generation: guessGeneration(platform, year),
      fuel: get('FuelTypePrimary'),
      warning: errorCode.split(',').every((c) => c.trim() === '0') ? null : `NHTSA note: ${get('ErrorText') ?? 'partial decode'}`,
    },
  };
}
