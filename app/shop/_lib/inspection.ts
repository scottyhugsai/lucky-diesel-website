/* Inspection vocabulary shared by the builder UI and its server actions. */

export const INSPECTION_CATEGORIES = [
  'Turbo & boost',
  'Fuel system',
  'Engine',
  'Cooling',
  'Transmission',
  'Electrical',
  'Exhaust',
  'Tuning',
  'Suspension & brakes',
] as const;

export const RATINGS = ['green', 'yellow', 'red'] as const;
export type Rating = (typeof RATINGS)[number];

export const RATING_META: Record<Rating | 'na', { label: string; short: string; tone: string }> = {
  green: { label: 'Good', short: 'Good', tone: 'text-clover' },
  yellow: { label: 'Needs attention soon', short: 'Soon', tone: 'text-amber-300' },
  red: { label: 'Needs attention now', short: 'Now', tone: 'text-danger' },
  na: { label: 'Not rated', short: '—', tone: 'text-steel' },
};

export const MEDIA_EXTENSIONS: Record<string, { ext: string; kind: 'photo' | 'video' }> = {
  'image/jpeg': { ext: 'jpg', kind: 'photo' },
  'image/png': { ext: 'png', kind: 'photo' },
  'image/webp': { ext: 'webp', kind: 'photo' },
  'image/heic': { ext: 'heic', kind: 'photo' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/quicktime': { ext: 'mov', kind: 'video' },
};

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export function mediaPathPattern(workOrderId: string): RegExp {
  return new RegExp(`^work-orders/${workOrderId}/[0-9a-f-]{36}\\.(jpg|png|webp|heic|mp4|mov)$`);
}
