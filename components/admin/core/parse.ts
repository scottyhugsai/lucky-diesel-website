/* Form parsing for admin server actions. Every value from FormData is untrusted. */

export interface ActionState {
  error?: string;
  notice?: string;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class InputError extends Error {}

export function text(form: FormData, name: string, { max = 500, required = false, label = name } = {}): string | null {
  const raw = form.get(name);
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    if (required) throw new InputError(`${label} is required.`);
    return null;
  }
  if (value.length > max) throw new InputError(`${label} must be ${max} characters or fewer.`);
  return value;
}

export function requiredText(form: FormData, name: string, label: string, max = 500): string {
  return text(form, name, { max, required: true, label }) as string;
}

export function uuid(form: FormData, name: string, { required = true, label = name } = {}): string | null {
  const value = text(form, name, { max: 36, required, label });
  if (value && !UUID_RE.test(value)) throw new InputError(`${label} is not valid.`);
  return value;
}

export function requiredUuid(form: FormData, name: string, label = 'Record'): string {
  return uuid(form, name, { required: true, label }) as string;
}

export function oneOf<T extends string>(form: FormData, name: string, options: readonly T[], label = name): T {
  const value = form.get(name);
  if (typeof value !== 'string' || !(options as readonly string[]).includes(value)) throw new InputError(`Pick a valid ${label}.`);
  return value as T;
}

export function number(form: FormData, name: string, { min = 0, max = 1_000_000, required = false, integer = false, label = name } = {}): number | null {
  const value = text(form, name, { max: 20, required, label });
  if (value === null) return null;
  const parsed = Number(value.replace(/,/g, ''));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new InputError(`${label} must be between ${min} and ${max}.`);
  if (integer && !Number.isInteger(parsed)) throw new InputError(`${label} must be a whole number.`);
  return parsed;
}

/** "$1,299.50" → 129950. */
export function dollarsToCents(form: FormData, name: string, { required = false, label = name, max = 100_000 } = {}): number | null {
  const raw = text(form, name, { max: 20, required, label });
  if (raw === null) return null;
  const parsed = Number(raw.replace(/[$,\s]/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) throw new InputError(`${label} must be a dollar amount up to $${max.toLocaleString('en-US')}.`);
  return Math.round(parsed * 100);
}

export function checkbox(form: FormData, name: string): boolean {
  const value = form.get(name);
  return value === 'on' || value === 'true' || value === '1';
}

export function email(form: FormData, name: string, { required = false } = {}): string | null {
  const value = text(form, name, { max: 254, required, label: 'Email' });
  if (value === null) return null;
  if (!EMAIL_RE.test(value)) throw new InputError('Enter a valid email.');
  return value.toLowerCase();
}

export function phone(form: FormData, name: string, { required = false } = {}): string | null {
  const value = text(form, name, { max: 30, required, label: 'Phone' });
  if (value === null) return null;
  const digits = value.replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (national.length !== 10) throw new InputError('Enter a 10-digit phone number.');
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}

export function vin(value: string | null): string | null {
  if (!value) return null;
  const clean = value.toUpperCase().replace(/\s/g, '');
  if (!/^[A-HJ-NPR-Z0-9]{11,17}$/.test(clean)) throw new InputError('VIN must be 11–17 letters and numbers (no I, O or Q).');
  return clean;
}

/** `datetime-local` input (shop time, America/New_York) → ISO string. */
export function shopDateTime(form: FormData, name: string, label = name): string | null {
  const value = text(form, name, { max: 20, label });
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new InputError(`${label} is not a valid date and time.`);
  const asUtc = new Date(`${value}:00Z`);
  const offsetMinutes = shopOffsetMinutes(asUtc);
  return new Date(asUtc.getTime() - offsetMinutes * 60_000).toISOString();
}

/** Minutes the shop's wall clock is ahead of UTC at a given instant (negative in the US). */
export function shopOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((wall - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/** ISO → value for a `datetime-local` input in shop time. */
export function toShopInputValue(iso: string | null): string {
  if (!iso) return '';
  const at = new Date(iso);
  return new Date(at.getTime() + shopOffsetMinutes(at) * 60_000).toISOString().slice(0, 16);
}

/** Wraps an action body so validation errors come back as `{ error }` for useActionState. */
export async function guard(body: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await body();
  } catch (caught) {
    if (caught instanceof InputError) return { error: caught.message };
    // Framework control flow (redirect/notFound) must keep propagating.
    if (caught instanceof Error && 'digest' in caught) throw caught;
    const message = caught instanceof Error ? caught.message : String(caught);
    console.error(`[admin] action failed: ${message}`);
    return { error: `Something went wrong. ${message}` };
  }
}
