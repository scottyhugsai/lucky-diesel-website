import { type BlockDef, type BlockValues, type Field, type FieldValue, defaultsFor, wordCount } from './fields';

/** A value the owner typed is wrong. Surfaced back to the form, never logged as a crash. */
export class ContentError extends Error {}

const SAFE_SCHEMES = /^(https:\/\/|tel:|sms:|mailto:)/i;
const STORAGE_PATH = '/storage/v1/object/public/';

function asString(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

function checkLength(field: Field & { max: number; maxWords?: number }, value: string): void {
  if (value.length > field.max) throw new ContentError(`${field.label} must be ${field.max} characters or fewer.`);
  if (field.maxWords && wordCount(value) > field.maxWords) {
    throw new ContentError(`${field.label} must be ${field.maxWords} words or fewer — it has ${wordCount(value)}.`);
  }
}

function link(label: string, value: string): string {
  if (!value) return '';
  if (value.startsWith('/')) return value;
  if (!SAFE_SCHEMES.test(value)) throw new ContentError(`${label} must be a link on this site, an https:// address, or a phone/email link.`);
  return value;
}

function image(label: string, value: string): string {
  if (!value) return '';
  if (value.startsWith('/')) return value;
  if (value.startsWith('https://') && value.includes(STORAGE_PATH)) return value;
  throw new ContentError(`${label} must be a photo from the media library or one of the site's own images.`);
}

function list(field: Field & { kind: 'list' }, input: unknown): readonly string[] {
  if (!Array.isArray(input)) throw new ContentError(`${field.label} is not a valid ordering.`);
  const allowed = new Set(field.options.map((option) => option.value));
  const seen: string[] = [];
  for (const raw of input) {
    const value = asString(raw);
    if (!allowed.has(value)) throw new ContentError(`${field.label} contains an unknown item.`);
    if (!seen.includes(value)) seen.push(value);
  }
  if (field.min !== undefined && seen.length < field.min) throw new ContentError(`${field.label} needs at least ${field.min}.`);
  if (field.max !== undefined && seen.length > field.max) throw new ContentError(`${field.label} allows at most ${field.max}.`);
  return seen;
}

function fieldValue(field: Field, input: Record<string, unknown>): FieldValue {
  const raw = input[field.name];
  switch (field.kind) {
    case 'boolean':
      return raw === true || raw === 'on' || raw === 'true' || raw === '1';
    case 'select': {
      // Empty means "use the built-in default", the same as a cleared text field.
      const value = asString(raw);
      if (value && !field.options.some((option) => option.value === value)) throw new ContentError(`Pick a valid ${field.label.toLowerCase()}.`);
      return value;
    }
    case 'image':
      return image(field.label, asString(raw));
    case 'list':
      return list(field, raw ?? []);
    case 'url': {
      const value = asString(raw);
      checkLength(field, value);
      return link(field.label, value);
    }
    default: {
      const value = asString(raw);
      checkLength(field, value);
      return value;
    }
  }
}

/** Untrusted form input → the values we are willing to store. Throws ContentError on anything invalid. */
export function validateBlock(def: BlockDef, input: Record<string, unknown>): BlockValues {
  const values: Record<string, FieldValue> = {};
  for (const field of def.fields) values[field.name] = fieldValue(field, input);
  return values;
}

function isEmpty(value: FieldValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Stored values over the built-in defaults, so a cleared field restores the shipped copy. */
export function mergeValues(def: BlockDef, stored: BlockValues | null | undefined, design?: string): BlockValues {
  const values: Record<string, FieldValue> = { ...defaultsFor(def, design) };
  if (!stored) return values;
  for (const field of def.fields) {
    const value = stored[field.name];
    if (field.kind === 'boolean') {
      if (typeof value === 'boolean') values[field.name] = value;
      continue;
    }
    if (!isEmpty(value)) values[field.name] = value as FieldValue;
  }
  return values;
}
