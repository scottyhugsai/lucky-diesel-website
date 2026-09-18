import { describe, expect, it } from 'vitest';
import type { BlockDef } from './fields';
import { changedFields, describeChange } from './diff';

const def: BlockDef = {
  key: 'home.hero', group: 'home', title: 'Hero',
  fields: [
    { kind: 'text', name: 'headline', label: 'Headline', max: 90 },
    { kind: 'textarea', name: 'subhead', label: 'Sub-headline', max: 240 },
    { kind: 'boolean', name: 'enabled', label: 'Show it' },
    { kind: 'list', name: 'order', label: 'Order', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
  ],
  defaults: { headline: 'Hi', subhead: '', enabled: true, order: ['a', 'b'] },
};

describe('changedFields', () => {
  it('lists only fields whose value moved', () => {
    expect(changedFields(def, { headline: 'Hi', enabled: true }, { headline: 'Hey', enabled: true })).toEqual(['headline']);
  });

  it('compares lists by order, not just membership', () => {
    expect(changedFields(def, { order: ['a', 'b'] }, { order: ['b', 'a'] })).toEqual(['order']);
    expect(changedFields(def, { order: ['a', 'b'] }, { order: ['a', 'b'] })).toEqual([]);
  });

  it('treats a missing value as empty rather than as a change to undefined', () => {
    expect(changedFields(def, {}, { headline: '' })).toEqual([]);
    expect(changedFields(def, {}, { headline: 'New' })).toEqual(['headline']);
  });

  it('notices a boolean turned off', () => {
    expect(changedFields(def, { enabled: true }, { enabled: false })).toEqual(['enabled']);
  });
});

describe('describeChange', () => {
  it('names the fields in plain language', () => {
    expect(describeChange(def, { headline: 'Hi' }, { headline: 'Hey', subhead: 'New line' })).toBe('Headline, Sub-headline');
  });

  it('says so when nothing moved', () => {
    expect(describeChange(def, { headline: 'Hi' }, { headline: 'Hi' })).toBe('No changes');
  });

  it('stays within the audit summary limit', () => {
    const wide: BlockDef = {
      ...def,
      fields: Array.from({ length: 40 }, (_unused, index) => ({ kind: 'text' as const, name: `f${index}`, label: `A rather long field label number ${index}`, max: 50 })),
      defaults: {},
    };
    const after = Object.fromEntries(wide.fields.map((field) => [field.name, 'x']));
    expect(describeChange(wide, {}, after).length).toBeLessThanOrEqual(300);
  });
});
