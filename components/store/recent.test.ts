import { describe, expect, test } from 'vitest';
import { MAX_RECENT, parseRecent, withRecent } from './recent';

describe('recently viewed handles', () => {
  test('reads a valid list and drops what is not a handle', () => {
    expect(parseRecent('ddp-cp3,BAD HANDLE,ez-lynk-autoagent-3,,ddp-cp3')).toEqual(['ddp-cp3', 'ez-lynk-autoagent-3']);
    expect(parseRecent(undefined)).toEqual([]);
    expect(parseRecent('<script>')).toEqual([]);
  });

  test('caps the list', () => {
    const many = Array.from({ length: MAX_RECENT + 4 }, (_unused, i) => `part-${i}`).join(',');
    expect(parseRecent(many)).toHaveLength(MAX_RECENT);
  });

  test('puts the newest first without repeating it', () => {
    expect(withRecent(['a-part', 'b-part'], 'c-part')).toEqual(['c-part', 'a-part', 'b-part']);
    expect(withRecent(['a-part', 'b-part'], 'b-part')).toEqual(['b-part', 'a-part']);
  });

  test('refuses a handle it cannot vouch for', () => {
    expect(withRecent(['a-part'], 'not a handle')).toEqual(['a-part']);
  });
});
