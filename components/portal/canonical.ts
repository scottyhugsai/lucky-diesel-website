import type { Json } from '@/lib/db/database.types';

/**
 * JSON with object keys sorted at every level. Postgres jsonb reorders keys,
 * so hashing this form lets a stored snapshot be re-verified later.
 */
export function canonicalJson(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const item = value[key];
        return item === undefined ? [] : [`${JSON.stringify(key)}:${canonicalJson(item)}`];
      });
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
