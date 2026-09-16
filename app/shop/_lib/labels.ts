interface VehicleLike {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  platform?: string | null;
  generation?: string | null;
  engine_code?: string | null;
}

/** '2021 GMC Sierra 2500HD' */
export function truckName(vehicle: VehicleLike | null | undefined): string {
  if (!vehicle) return 'Unknown truck';
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Unknown truck';
}

/** 'Duramax L5P 6.6L' / '6.7 Powerstroke' — what a tech actually calls the engine. */
export function engineName(vehicle: VehicleLike | null | undefined): string | null {
  if (!vehicle) return null;
  const platform = vehicle.platform && vehicle.platform !== 'other' ? vehicle.platform[0]!.toUpperCase() + vehicle.platform.slice(1) : null;
  const code = vehicle.engine_code ?? null;
  if (code && platform && code.toLowerCase().includes(platform.toLowerCase())) return code;
  const generation = vehicle.generation?.replace(/^[\d.]+[–-](?:\d{4}|Present)\s*/, '') ?? null;
  const detail = generation || code;
  return [platform, detail].filter(Boolean).join(' ') || null;
}

export const ACTIVE_STATUSES = ['estimate', 'awaiting_approval', 'approved', 'in_progress', 'waiting_parts', 'quality_check', 'ready'] as const;
