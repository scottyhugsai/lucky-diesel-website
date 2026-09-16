/* Form parsing for admin server actions. Every value from the browser is untrusted. */

export interface ActionState {
  error?: string;
  notice?: string;
  /** Changes on every result so client components can react (toasts, resets). */
  at?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const TEMPLATE_MAX = 1600;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export function isDate(value: unknown): value is string {
  return typeof value === 'string' && DATE.test(value) && !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
}

export function str(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

export function oneOf<T extends string>(value: unknown, options: readonly T[]): T | null {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : null;
}

/** Parses a number within bounds; null when missing or out of range. */
export function numberIn(formData: FormData, key: string, min: number, max: number, { integer = false } = {}): number | null {
  const cleaned = str(formData, key).replace(/[$,%\s]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < min || value > max) return null;
  if (integer && !Number.isInteger(value)) return null;
  return value;
}

export function checked(formData: FormData, key: string): boolean {
  const raw = formData.get(key);
  return raw === 'on' || raw === 'true' || raw === '1';
}

export function ok(notice: string): ActionState {
  return { notice, at: Date.now() };
}

export function fail(error: string): ActionState {
  return { error, at: Date.now() };
}

export function formatPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return null;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}
