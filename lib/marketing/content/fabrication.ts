/**
 * No-fabrication post-check for AI output. Every number, dollar amount,
 * percentage or star rating in the output must appear in the facts the model
 * was given; anything else is returned so the caller can flag or block it.
 * Pure.
 */

/** Money, percentages, ratings, numbers with units, and plain numbers. */
const TOKEN = /\$\s?\d[\d,]*(?:\.\d+)?[kK]?|\d[\d,]*(?:\.\d+)?\s?%|\d(?:\.\d)?\s?(?:-|\s)?stars?\b|\b\d[\d,]*(?:\.\d+)?\s?(?:hp|whp|lb[\s-]?ft|ft[\s-]?lbs?|miles?|mi\b|mpg|psi|years?|months?|days?|hours?|weeks?|leads?|reviews?|posts?|bookings?|clicks?)\b|\b\d[\d,]*(?:\.\d+)?\b/gi;
const PHONE = /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const URL = /\bhttps?:\/\/\S+/gi;
/** Small counts ("2 steps", "one of 3") are not treated as claims. */
const SMALL_INT_MAX = 12;

function numericValue(token: string): number | null {
  const kilo = /\d[kK]$/.test(token.trim());
  const match = token.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? (kilo ? value * 1000 : value) : null;
}

function collectFactStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 6 || value === null || value === undefined) return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    out.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectFactStrings(item, out, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      collectFactStrings(item, out, depth + 1);
      // Cent amounts are allowed to appear as dollars.
      if (typeof item === 'number' && /cents/i.test(key)) out.push(String(item / 100), String(Math.round(item / 100)));
    }
  }
}

function roundings(value: number): number[] {
  return [value, Math.round(value), Math.round(value * 10) / 10, Math.round(value * 100) / 100, Math.floor(value), Math.ceil(value)];
}

/** Every numeric value the facts contain, plus common roundings. */
export function factNumbers(facts: unknown): Set<number> {
  const strings: string[] = [];
  collectFactStrings(facts, strings);
  const numbers = new Set<number>();
  for (const text of strings) {
    for (const found of text.replace(/,/g, '').matchAll(/\d+(?:\.\d+)?/g)) {
      for (const r of roundings(Number(found[0]))) numbers.add(r);
    }
  }
  return numbers;
}

export interface FabricationReport {
  ok: boolean;
  /** Tokens as written in the output that no fact supports. */
  unverified: string[];
}

export function findUnverifiedClaims(output: string, facts: unknown, allow: readonly string[] = []): FabricationReport {
  const known = factNumbers([facts, allow]);
  const strings: string[] = [];
  collectFactStrings([facts, allow], strings);
  const factDigits = strings.map((s) => s.replace(/\D/g, '')).filter((d) => d.length >= 10);
  const cleaned = output.replace(URL, ' ').replace(PHONE, (phone) => {
    const digits = phone.replace(/\D/g, '');
    return factDigits.some((d) => d.endsWith(digits)) ? ' ' : `$PHONE${digits}`;
  });
  const unverified: string[] = [];
  for (const phone of cleaned.matchAll(/\$PHONE(\d+)/g)) unverified.push(phone[1]!);
  for (const found of cleaned.replace(/\$PHONE\d+/g, ' ').matchAll(TOKEN)) {
    const token = found[0].trim();
    const value = numericValue(token);
    if (value === null) continue;
    const plain = /^\d+$/.test(token);
    if (plain && value <= SMALL_INT_MAX) continue;
    if (/^(19|20)\d{2}$/.test(token)) continue; // model years and dates read as years
    if (known.has(value) || roundings(value).some((r) => known.has(r))) continue;
    if (!unverified.includes(token)) unverified.push(token);
  }
  return { ok: unverified.length === 0, unverified };
}
