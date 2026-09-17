/**
 * Segment rule DSL. Rules are JSON (stored in `segments.rules`), validated
 * against a whitelist and evaluated in memory against contact facts that were
 * loaded with fixed, parameterised queries. User input never becomes SQL.
 */

export const SERVICE_CATEGORIES = [
  'tune', 'turbo', 'injectors', 'fuel', 'exhaust', 'transmission', 'maintenance', 'diagnostics', 'head_studs', 'engine',
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const LIFECYCLE_STAGES = ['subscriber', 'lead', 'customer', 'repeat', 'vip', 'lapsed', 'lost'] as const;
export const LOYALTY_TIERS = ['stock', 'stage_1', 'stage_2', 'full_build'] as const;
export type LoyaltyTier = (typeof LOYALTY_TIERS)[number];
/** How a truck is used. Mirrors the check constraint on `vehicles.usage`. */
export const TRUCK_USAGES = ['towing', 'daily', 'work', 'show', 'fleet', 'offroad'] as const;
export type TruckUsage = (typeof TRUCK_USAGES)[number];

type NumericField = 'mileage' | 'days_since_last_visit' | 'lifetime_value_cents' | 'paid_visits' | 'overdue_ratio';
type ListField = 'platform' | 'generation' | 'lifecycle_stage' | 'loyalty_tier' | 'source' | 'usage';

export type SegmentCondition =
  | { field: ListField; op: 'in' | 'not_in'; values: string[] }
  | { field: NumericField; op: 'gte' | 'lte'; value: number }
  | { field: NumericField; op: 'between'; min: number; max: number }
  | { field: 'tags'; op: 'has_any' | 'has_all' | 'has_none'; values: string[] }
  | { field: 'service_history'; op: 'has_any' | 'has_none'; values: ServiceCategory[]; within_days?: number }
  | { field: 'consent'; op: 'is'; value: 'sms_marketing' | 'email_marketing' }
  | { field: 'fleet' | 'has_visited'; op: 'is'; value: boolean };

export interface SegmentRules {
  match: 'all' | 'any';
  conditions: SegmentCondition[];
}

export interface ContactFacts {
  customerId: string;
  platforms: string[];
  generations: string[];
  /** Highest known (or predicted) odometer across the customer's trucks. */
  mileage: number | null;
  lastVisitAt: Date | null;
  paidVisits: number;
  lifetimeValueCents: number;
  tags: string[];
  smsMarketing: boolean;
  emailMarketing: boolean;
  lifecycleStage: string;
  loyaltyTier: string;
  source: string;
  isFleet: boolean;
  services: { category: ServiceCategory; at: Date }[];
  /** Usage across trucks the customer still owns. */
  usage: string[];
  /** Days since last visit ÷ usual visit interval; null without a rhythm. */
  overdueRatio: number | null;
}

const MAX_CONDITIONS = 25;
const MAX_VALUES = 50;
const MAX_VALUE_LENGTH = 64;
const LIST_FIELDS = new Set<string>(['platform', 'generation', 'lifecycle_stage', 'loyalty_tier', 'source', 'usage']);
const NUMERIC_FIELDS = new Set<string>(['mileage', 'days_since_last_visit', 'lifetime_value_cents', 'paid_visits', 'overdue_ratio']);
const DAY_MS = 86_400_000;

const SERVICE_PATTERNS: [ServiceCategory, RegExp][] = [
  ['tune', /\b(?:tun(?:e|ed|er|ing)|calibration|ez-?lynk|efilive|hp tuners)\b/i],
  ['turbo', /\bturbo/i],
  ['injectors', /\binjector/i],
  ['fuel', /\b(?:cp3|cp4|fuel (?:system|pump)|lift pump)\b/i],
  ['exhaust', /\bexhaust|downpipe/i],
  ['transmission', /\b(?:trans(?:mission)?|allison|torque converter)\b/i],
  ['maintenance', /\b(?:maintenance|oil|filter|service labor)\b/i],
  ['diagnostics', /\bdiagnos/i],
  ['head_studs', /\bhead studs?\b/i],
  ['engine', /\b(?:engine build|head gasket|rebuild)\b/i],
];

/** Service categories mentioned in a job title, line item or build item. */
export function categorizeService(text: string | null | undefined): ServiceCategory[] {
  if (!text) return [];
  return SERVICE_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([category]) => category);
}

export type ParseResult = { ok: true; rules: SegmentRules } | { ok: false; error: string };

function stringList(value: unknown, allowed?: readonly string[]): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_VALUES) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || item.length > MAX_VALUE_LENGTH) return null;
    const normalized = item.trim().toLowerCase();
    if (allowed && !allowed.includes(normalized)) return null;
    out.push(normalized);
  }
  return [...new Set(out)];
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function parseCondition(raw: unknown): SegmentCondition | string {
  if (!raw || typeof raw !== 'object') return 'condition must be an object';
  const c = raw as Record<string, unknown>;
  const field = String(c.field ?? '');
  const op = String(c.op ?? '');

  if (LIST_FIELDS.has(field)) {
    if (op !== 'in' && op !== 'not_in') return `${field}: op must be in or not_in`;
    const allowed = field === 'lifecycle_stage' ? LIFECYCLE_STAGES : field === 'loyalty_tier' ? LOYALTY_TIERS : field === 'usage' ? TRUCK_USAGES : undefined;
    const values = stringList(c.values, allowed);
    return values ? { field: field as ListField, op, values } : `${field}: values must be a list of known strings`;
  }
  if (NUMERIC_FIELDS.has(field)) {
    if (op === 'between') {
      return isNumber(c.min) && isNumber(c.max) && c.min <= c.max
        ? { field: field as NumericField, op, min: c.min, max: c.max }
        : `${field}: between needs min ≤ max`;
    }
    if (op !== 'gte' && op !== 'lte') return `${field}: op must be gte, lte or between`;
    return isNumber(c.value) ? { field: field as NumericField, op, value: c.value } : `${field}: value must be a number`;
  }
  if (field === 'tags') {
    if (op !== 'has_any' && op !== 'has_all' && op !== 'has_none') return 'tags: unknown op';
    const values = stringList(c.values);
    return values ? { field, op, values } : 'tags: values must be a list of strings';
  }
  if (field === 'service_history') {
    if (op !== 'has_any' && op !== 'has_none') return 'service_history: op must be has_any or has_none';
    const values = stringList(c.values, SERVICE_CATEGORIES);
    if (!values) return 'service_history: unknown service category';
    if (c.within_days !== undefined && !isNumber(c.within_days)) return 'service_history: within_days must be a number';
    return { field, op, values: values as ServiceCategory[], ...(isNumber(c.within_days) ? { within_days: c.within_days } : {}) };
  }
  if (field === 'consent') {
    return op === 'is' && (c.value === 'sms_marketing' || c.value === 'email_marketing') ? { field, op, value: c.value } : 'consent: value must be sms_marketing or email_marketing';
  }
  if (field === 'fleet' || field === 'has_visited') {
    return op === 'is' && typeof c.value === 'boolean' ? { field, op, value: c.value } : `${field}: value must be true or false`;
  }
  return `unknown field “${field.slice(0, 40)}”`;
}

export function parseSegmentRules(input: unknown): ParseResult {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Rules must be an object.' };
  const { match, conditions } = input as Record<string, unknown>;
  if (match !== 'all' && match !== 'any') return { ok: false, error: 'match must be “all” or “any”.' };
  if (!Array.isArray(conditions)) return { ok: false, error: 'conditions must be a list.' };
  if (conditions.length > MAX_CONDITIONS) return { ok: false, error: `At most ${MAX_CONDITIONS} conditions.` };
  const parsed: SegmentCondition[] = [];
  for (const [index, raw] of conditions.entries()) {
    const result = parseCondition(raw);
    if (typeof result === 'string') return { ok: false, error: `Condition ${index + 1}: ${result}` };
    parsed.push(result);
  }
  return { ok: true, rules: { match, conditions: parsed } };
}

function numericValue(field: NumericField, facts: ContactFacts, now: Date): number | null {
  switch (field) {
    case 'mileage': return facts.mileage;
    case 'days_since_last_visit': return facts.lastVisitAt ? Math.floor((now.getTime() - facts.lastVisitAt.getTime()) / DAY_MS) : null;
    case 'lifetime_value_cents': return facts.lifetimeValueCents;
    case 'paid_visits': return facts.paidVisits;
    case 'overdue_ratio': return facts.overdueRatio;
  }
}

function listValues(field: ListField, facts: ContactFacts): string[] {
  switch (field) {
    case 'platform': return facts.platforms.map((p) => p.toLowerCase());
    case 'generation': return facts.generations.map((g) => g.toLowerCase());
    case 'lifecycle_stage': return [facts.lifecycleStage];
    case 'loyalty_tier': return [facts.loyaltyTier];
    case 'source': return [facts.source.toLowerCase()];
    case 'usage': return facts.usage;
  }
}

export function matchesCondition(condition: SegmentCondition, facts: ContactFacts, now: Date): boolean {
  switch (condition.field) {
    case 'platform': case 'generation': case 'lifecycle_stage': case 'loyalty_tier': case 'source': case 'usage': {
      const have = listValues(condition.field, facts);
      // Generations match by substring so “l5p” finds “2017–Present L5P 6.6L”.
      const hit = condition.values.some((v) => have.some((h) => (condition.field === 'generation' ? h.includes(v) : h === v)));
      return condition.op === 'in' ? hit : !hit;
    }
    case 'mileage': case 'days_since_last_visit': case 'lifetime_value_cents': case 'paid_visits': case 'overdue_ratio': {
      const value = numericValue(condition.field, facts, now);
      if (value === null) return false;
      if (condition.op === 'between') return value >= condition.min && value <= condition.max;
      return condition.op === 'gte' ? value >= condition.value : value <= condition.value;
    }
    case 'tags': {
      const tags = new Set(facts.tags.map((t) => t.toLowerCase()));
      if (condition.op === 'has_all') return condition.values.every((v) => tags.has(v));
      const any = condition.values.some((v) => tags.has(v));
      return condition.op === 'has_any' ? any : !any;
    }
    case 'service_history': {
      const since = condition.within_days === undefined ? null : now.getTime() - condition.within_days * DAY_MS;
      const any = facts.services.some((s) => condition.values.includes(s.category) && (since === null || s.at.getTime() >= since));
      return condition.op === 'has_any' ? any : !any;
    }
    case 'consent':
      return condition.value === 'sms_marketing' ? facts.smsMarketing : facts.emailMarketing;
    case 'fleet':
      return facts.isFleet === condition.value;
    case 'has_visited':
      return (facts.paidVisits > 0) === condition.value;
  }
}

/** Empty rule sets match nobody, so a half-built segment can't blast the whole list. */
export function matchesRules(rules: SegmentRules, facts: ContactFacts, now: Date): boolean {
  if (rules.conditions.length === 0) return false;
  return rules.match === 'all'
    ? rules.conditions.every((c) => matchesCondition(c, facts, now))
    : rules.conditions.some((c) => matchesCondition(c, facts, now));
}

export function evaluateSegment(rules: SegmentRules, contacts: readonly ContactFacts[], now: Date): string[] {
  return contacts.filter((facts) => matchesRules(rules, facts, now)).map((facts) => facts.customerId);
}
