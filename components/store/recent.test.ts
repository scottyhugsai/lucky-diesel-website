import { describe, expect, test } from 'vitest';
import { MAX_RECENT, parseRecent, recentProducts, withRecent } from './recent';

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

describe('resolving remembered handles to products', () => {
  const product = (handle: string) => ({ handle, title: handle });
  const catalog = [product('ddp-cp3'), product('ez-lynk'), product('s475-kit')];

  test('returns them in the order they were viewed, not catalog order', () => {
    expect(recentProducts(catalog, ['s475-kit', 'ddp-cp3']).map((p) => p.handle)).toEqual(['s475-kit', 'ddp-cp3']);
  });

  test('drops a handle the catalog no longer carries', () => {
    expect(recentProducts(catalog, ['gone-for-good', 'ez-lynk']).map((p) => p.handle)).toEqual(['ez-lynk']);
  });

  test('leaves out the part being looked at right now', () => {
    expect(recentProducts(catalog, ['ddp-cp3', 'ez-lynk'], { exclude: 'ddp-cp3' }).map((p) => p.handle)).toEqual(['ez-lynk']);
  });

  test('honours a limit', () => {
    expect(recentProducts(catalog, ['s475-kit', 'ddp-cp3', 'ez-lynk'], { limit: 2 })).toHaveLength(2);
  });

  test('has nothing to show when nothing was viewed', () => {
    expect(recentProducts(catalog, [])).toEqual([]);
  });
});
