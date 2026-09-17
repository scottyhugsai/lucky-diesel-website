import { describe, expect, test } from 'vitest';
import { findVariant, initialSelection, selectValue, valueState } from './variants';

const v = (optionValues: string[], available = true) => ({ optionValues, available });
// Size × Condition; 8mm/Reman doesn't exist, 10mm/New is sold out.
const variants = [v(['8mm', 'New']), v(['10mm', 'New'], false), v(['10mm', 'Reman']), v(['12mm', 'New']), v(['12mm', 'Reman'])];

describe('variant selection', () => {
  test('starts on the first in-stock variant', () => {
    expect(initialSelection([v(['A'], false), v(['B'])])).toEqual(['B']);
    expect(initialSelection([v(['A'], false)])).toEqual(['A']);
    expect(initialSelection([])).toEqual([]);
  });

  test('finds exact matches only', () => {
    expect(findVariant(variants, ['12mm', 'Reman'])).toBe(variants[4]);
    expect(findVariant(variants, ['8mm', 'Reman'])).toBeNull();
    expect(findVariant([v([])], [])).not.toBeNull();
  });

  test('reports available, sold-out and missing combinations', () => {
    expect(valueState(variants, ['8mm', 'New'], 0, '12mm')).toBe('available');
    expect(valueState(variants, ['8mm', 'New'], 0, '10mm')).toBe('soldout');
    expect(valueState(variants, ['8mm', 'New'], 1, 'Reman')).toBe('missing');
  });

  test('keeps other choices when the combination exists', () => {
    expect(selectValue(variants, ['12mm', 'New'], 1, 'Reman')).toEqual(['12mm', 'Reman']);
  });

  test('jumps to the nearest in-stock variant when the combination is missing', () => {
    expect(selectValue(variants, ['12mm', 'Reman'], 0, '8mm')).toEqual(['8mm', 'New']);
    expect(selectValue(variants, ['12mm', 'Reman'], 1, 'New')).toEqual(['12mm', 'New']);
    // 10mm/New exists (sold out), so it is kept and shown as sold out rather than jumped away from.
    expect(selectValue(variants, ['12mm', 'New'], 0, '10mm')).toEqual(['10mm', 'New']);
  });

  test('ignores values the product does not have', () => {
    const selection = ['12mm', 'New'];
    const next = selectValue(variants, selection, 0, '99mm');
    expect(next).toEqual(selection);
    expect(next).not.toBe(selection);
  });
});
