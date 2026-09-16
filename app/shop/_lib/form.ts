/* Form parsing for shop-floor server actions. Every value from the browser is untrusted. */

export interface ActionState {
  error?: string;
  notice?: string;
  /** Changes on every success so client forms can reset themselves. */
  savedAt?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export function text(formData: FormData, key: string, { max = 500, required = false } = {}): { value: string | null; error?: string } {
  const raw = formData.get(key);
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return required ? { value: null, error: 'required' } : { value: null };
  if (value.length > max) return { value: null, error: `must be ${max} characters or fewer` };
  return { value };
}

/** Parses an optional number within bounds. Empty → null. */
export function num(formData: FormData, key: string, { min = 0, max = 1_000_000, integer = false } = {}): { value: number | null; error?: string } {
  const raw = formData.get(key);
  const cleaned = typeof raw === 'string' ? raw.replace(/[$,\s]/g, '') : '';
  if (!cleaned) return { value: null };
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < min || value > max) return { value: null, error: `must be between ${min} and ${max}` };
  if (integer && !Number.isInteger(value)) return { value: null, error: 'must be a whole number' };
  return { value };
}

export function oneOf<T extends string>(formData: FormData, key: string, options: readonly T[]): T | null {
  const raw = formData.get(key);
  return typeof raw === 'string' && (options as readonly string[]).includes(raw) ? (raw as T) : null;
}

export function checked(formData: FormData, key: string): boolean {
  const raw = formData.get(key);
  return raw === 'on' || raw === 'true' || raw === '1';
}

export function ok(notice?: string): ActionState {
  return { notice, savedAt: Date.now() };
}

export function fail(error: string): ActionState {
  return { error };
}
