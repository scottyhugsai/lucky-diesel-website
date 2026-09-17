/** Pure variant-selection logic for the product page picker. */
import type { StoreVariant } from '@/lib/store/normalize';

export type Selection = readonly string[];
export type ValueState = 'available' | 'soldout' | 'missing';

type VariantLike = Pick<StoreVariant, 'optionValues' | 'available'>;

/** Starting selection: the first in-stock variant, falling back to the first variant. */
export function initialSelection<V extends VariantLike>(variants: readonly V[]): string[] {
  const start = variants.find((v) => v.available) ?? variants[0];
  return start ? [...start.optionValues] : [];
}

/** The variant whose option values exactly match the selection, if one exists. */
export function findVariant<V extends VariantLike>(variants: readonly V[], selection: Selection): V | null {
  return variants.find((v) => v.optionValues.length === selection.length && v.optionValues.every((value, i) => value === selection[i])) ?? null;
}

/**
 * Whether picking `value` for option `optionIndex`, keeping every other current choice,
 * lands on an in-stock variant, a sold-out one, or a combination the store doesn't offer.
 */
export function valueState(variants: readonly VariantLike[], selection: Selection, optionIndex: number, value: string): ValueState {
  const candidates = variants.filter((v) =>
    v.optionValues[optionIndex] === value && v.optionValues.every((other, i) => i === optionIndex || other === selection[i]),
  );
  if (!candidates.length) return 'missing';
  return candidates.some((v) => v.available) ? 'available' : 'soldout';
}

/**
 * Choose `value` for an option. If that breaks the combination, move the other options to
 * the closest variant that has the value (in stock first, then most choices kept).
 */
export function selectValue<V extends VariantLike>(variants: readonly V[], selection: Selection, optionIndex: number, value: string): string[] {
  const next = selection.map((current, i) => (i === optionIndex ? value : current));
  if (findVariant(variants, next)) return next;

  const withValue = variants.filter((v) => v.optionValues[optionIndex] === value);
  if (!withValue.length) return [...selection];
  const score = (v: V) => (v.available ? 1000 : 0) + v.optionValues.filter((other, i) => other === next[i]).length;
  const best = withValue.reduce((a, b) => (score(b) > score(a) ? b : a));
  return [...best.optionValues];
}
