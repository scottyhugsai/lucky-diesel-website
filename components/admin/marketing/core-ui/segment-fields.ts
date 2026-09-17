/* Rule builder vocabulary: maps friendly rows to the segment rule DSL and back. Client-safe. */

import type { SegmentCondition, SegmentRules } from '@/lib/marketing/core/segment-rules';
import { PLATFORM_OPTIONS, SERVICE_LABEL, STAGE_LABEL, TIER_LABEL } from './labels';

export type FieldKind = 'choice' | 'text' | 'number' | 'money' | 'bool' | 'consent';

export interface FieldMeta {
  field: SegmentCondition['field'];
  label: string;
  group: string;
  kind: FieldKind;
  ops: { value: string; label: string }[];
  options?: { value: string; label: string }[];
  unit?: string;
  placeholder?: string;
  presets?: { label: string; op: string; min?: number; max?: number; value?: number }[];
}

const IN = [{ value: 'in', label: 'is any of' }, { value: 'not_in', label: 'is none of' }];
const RANGE = [{ value: 'between', label: 'between' }, { value: 'gte', label: 'at least' }, { value: 'lte', label: 'at most' }];
const toOptions = (map: Record<string, string>) => Object.entries(map).map(([value, label]) => ({ value, label }));

export const FIELDS: readonly FieldMeta[] = [
  { field: 'platform', label: 'Platform', group: 'Truck', kind: 'choice', ops: IN, options: [...PLATFORM_OPTIONS] },
  { field: 'generation', label: 'Generation / engine', group: 'Truck', kind: 'text', ops: IN, placeholder: 'L5P, 6.7, 5.9' },
  { field: 'mileage', label: 'Mileage', group: 'Truck', kind: 'number', ops: RANGE, unit: 'mi',
    presets: [{ label: 'Under 100k', op: 'lte', value: 100000 }, { label: '100k–200k', op: 'between', min: 100000, max: 200000 }, { label: '200k+', op: 'gte', value: 200000 }] },
  { field: 'service_history', label: 'Service history', group: 'Truck', kind: 'choice', ops: [{ value: 'has_any', label: 'has had' }, { value: 'has_none', label: 'never had' }], options: toOptions(SERVICE_LABEL) },
  { field: 'days_since_last_visit', label: 'Last visit', group: 'Visits', kind: 'number', ops: RANGE, unit: 'days ago',
    presets: [{ label: 'Within 90 days', op: 'lte', value: 90 }, { label: '6–12 months', op: 'between', min: 180, max: 365 }, { label: 'Over a year', op: 'gte', value: 365 }] },
  { field: 'paid_visits', label: 'Paid visits', group: 'Visits', kind: 'number', ops: RANGE, unit: 'visits' },
  { field: 'has_visited', label: 'Has visited', group: 'Visits', kind: 'bool', ops: [{ value: 'is', label: 'is' }] },
  { field: 'lifetime_value_cents', label: 'Lifetime value', group: 'Value', kind: 'money', ops: RANGE, unit: '$',
    presets: [{ label: '$1k+', op: 'gte', value: 1000 }, { label: '$5k+', op: 'gte', value: 5000 }] },
  { field: 'loyalty_tier', label: 'Loyalty tier', group: 'Value', kind: 'choice', ops: IN, options: toOptions(TIER_LABEL) },
  { field: 'lifecycle_stage', label: 'Lifecycle stage', group: 'Value', kind: 'choice', ops: IN, options: toOptions(STAGE_LABEL) },
  { field: 'tags', label: 'Tags', group: 'Profile', kind: 'text', ops: [{ value: 'has_any', label: 'has any' }, { value: 'has_all', label: 'has all' }, { value: 'has_none', label: 'has none' }], placeholder: 'tows, boat' },
  { field: 'source', label: 'Source', group: 'Profile', kind: 'text', ops: IN, placeholder: 'google, referral' },
  { field: 'fleet', label: 'Fleet account', group: 'Profile', kind: 'bool', ops: [{ value: 'is', label: 'is' }] },
  { field: 'consent', label: 'Can receive', group: 'Consent', kind: 'consent', ops: [{ value: 'is', label: 'is' }],
    options: [{ value: 'sms_marketing', label: 'Marketing texts' }, { value: 'email_marketing', label: 'Marketing email' }] },
];

export function fieldMeta(field: string): FieldMeta {
  return FIELDS.find((f) => f.field === field) ?? FIELDS[0]!;
}

export interface RowState {
  key: string;
  field: SegmentCondition['field'];
  op: string;
  values: string[];
  text: string;
  min: string;
  max: string;
  value: string;
  bool: boolean;
  withinDays: string;
}

let counter = 0;
export function newRow(field: SegmentCondition['field'] = 'platform', key?: string): RowState {
  counter += 1;
  const meta = fieldMeta(field);
  return {
    key: key ?? `r${counter}-${Math.random().toString(36).slice(2, 7)}`, field, op: meta.kind === 'number' || meta.kind === 'money' ? 'gte' : meta.ops[0]!.value,
    values: meta.kind === 'consent' ? ['sms_marketing'] : [], text: '', min: '', max: '', value: '', bool: true, withinDays: '',
  };
}

const num = (raw: string, money: boolean): number => {
  const n = Number(raw.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(money ? n * 100 : n) : NaN;
};

/** Converts one row to a DSL condition, or null while it is incomplete. */
export function toCondition(row: RowState): SegmentCondition | null {
  const meta = fieldMeta(row.field);
  const money = meta.kind === 'money';
  switch (meta.kind) {
    case 'choice':
    case 'text': {
      const values = meta.kind === 'text' ? row.text.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean) : row.values;
      if (!values.length) return null;
      if (row.field === 'service_history') {
        const days = num(row.withinDays, false);
        return { field: 'service_history', op: row.op as 'has_any', values: values as never, ...(row.withinDays && !Number.isNaN(days) ? { within_days: days } : {}) };
      }
      return { field: row.field, op: row.op, values } as SegmentCondition;
    }
    case 'number':
    case 'money': {
      if (row.op === 'between') {
        const min = num(row.min, money);
        const max = num(row.max, money);
        return Number.isNaN(min) || Number.isNaN(max) || !row.min || !row.max || min > max ? null : ({ field: row.field, op: 'between', min, max } as SegmentCondition);
      }
      const value = num(row.value, money);
      return !row.value || Number.isNaN(value) ? null : ({ field: row.field, op: row.op, value } as SegmentCondition);
    }
    case 'bool':
      return { field: row.field, op: 'is', value: row.bool } as SegmentCondition;
    case 'consent':
      return { field: 'consent', op: 'is', value: row.values[0] === 'email_marketing' ? 'email_marketing' : 'sms_marketing' };
  }
}

export function toRules(match: 'all' | 'any', rows: RowState[]): { rules: SegmentRules; incomplete: number } {
  const conditions = rows.map(toCondition);
  return { rules: { match, conditions: conditions.filter((c): c is SegmentCondition => c !== null) }, incomplete: conditions.filter((c) => c === null).length };
}

export function fromRules(rules: SegmentRules): RowState[] {
  return rules.conditions.map((c, index) => {
    const row = newRow(c.field, `init-${index}`);
    const money = c.field === 'lifetime_value_cents';
    const show = (n: number) => String(money ? n / 100 : n);
    if ('values' in c) return { ...row, op: c.op, values: c.values, text: c.values.join(', '), withinDays: 'within_days' in c && c.within_days !== undefined ? String(c.within_days) : '' };
    if (c.op === 'between') return { ...row, op: c.op, min: show(c.min), max: show(c.max) };
    if (c.field === 'consent') return { ...row, values: [c.value] };
    if (typeof c.value === 'boolean') return { ...row, bool: c.value };
    return { ...row, op: c.op, value: show(c.value as number) };
  });
}
