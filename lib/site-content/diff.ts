import type { BlockDef, BlockValues, FieldValue } from './fields';

const MAX_SUMMARY = 300;

/** Option values are slugs, so a comma join is unambiguous for comparison. */
function normalise(value: FieldValue | undefined, kind: string): string {
  if (kind === 'boolean') return value === true ? 'true' : 'false';
  if (Array.isArray(value)) return value.join(',');
  return typeof value === 'string' ? value : '';
}

/** Field names whose value differs between two versions of a block. */
export function changedFields(def: BlockDef, before: BlockValues | null | undefined, after: BlockValues | null | undefined): string[] {
  return def.fields
    .filter((field) => normalise(before?.[field.name], field.kind) !== normalise(after?.[field.name], field.kind))
    .map((field) => field.name);
}

/** A one-line, human summary for the audit trail. */
export function describeChange(def: BlockDef, before: BlockValues | null | undefined, after: BlockValues | null | undefined): string {
  const changed = changedFields(def, before, after);
  if (!changed.length) return 'No changes';
  const labels = changed.map((name) => def.fields.find((field) => field.name === name)?.label ?? name);
  const summary = labels.join(', ');
  if (summary.length <= MAX_SUMMARY) return summary;
  return `${summary.slice(0, MAX_SUMMARY - 1).replace(/,[^,]*$/, '')}…`;
}
