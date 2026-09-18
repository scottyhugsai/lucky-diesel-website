import { describe, expect, test } from 'vitest';
import { EMPTY_FITMENT } from './select';
import { decodeTruck, encodeTruck, safeReturnPath, truckFromFitment, truckFromSelection } from './truck-cookie';

const L5P = { year: 2020, make: 'chevrolet', model: 'chevrolet-silverado-2500hd', engine: 'gm-6-6-l5p' } as const;

describe('truck from a fitment pick', () => {
  test('keeps the pick and derives what the store filters on', () => {
    expect(truckFromFitment({ ...L5P })).toEqual({
      fitment: { ...L5P },
      selection: { platform: 'duramax', generationCollection: 'duramax-2017-present-l5p' },
    });
  });

  test('refuses an engine the shop does not work on', () => {
    expect(truckFromFitment({ ...L5P, engine: 'gm-6-6-l8t' })).toBeNull();
  });

  test('refuses an incomplete pick', () => {
    expect(truckFromFitment({ ...L5P, engine: null })).toBeNull();
    expect(truckFromFitment(EMPTY_FITMENT)).toBeNull();
  });
});

describe('truck from a platform and generation', () => {
  test('accepts a known pair and drops an unknown generation', () => {
    expect(truckFromSelection('duramax', 'duramax-2011-2016-lml')?.selection)
      .toEqual({ platform: 'duramax', generationCollection: 'duramax-2011-2016-lml' });
    expect(truckFromSelection('duramax', 'cummins-2013-2018-6-7l')?.selection)
      .toEqual({ platform: 'duramax', generationCollection: null });
  });

  test('refuses an unknown platform', () => {
    expect(truckFromSelection('hemi', null)).toBeNull();
    expect(truckFromSelection(undefined, undefined)).toBeNull();
  });
});

describe('cookie round trip', () => {
  test('a full pick survives encoding', () => {
    const saved = truckFromFitment({ ...L5P });
    expect(saved).not.toBeNull();
    expect(decodeTruck(encodeTruck(saved!))).toEqual(saved);
  });

  test('a platform-only truck survives encoding', () => {
    const saved = truckFromSelection('cummins', 'cummins-2019-present-6-7l');
    expect(decodeTruck(encodeTruck(saved!))).toEqual(saved);
  });

  test('a stale pick still yields the platform it was saved for', () => {
    expect(decodeTruck('year=1066&make=chevrolet&platform=duramax&gen=duramax-2011-2016-lml')).toEqual({
      fitment: EMPTY_FITMENT,
      selection: { platform: 'duramax', generationCollection: 'duramax-2011-2016-lml' },
    });
  });

  test('rubbish decodes to no truck rather than throwing', () => {
    expect(decodeTruck(undefined)).toBeNull();
    expect(decodeTruck('')).toBeNull();
    expect(decodeTruck('platform=<script>')).toBeNull();
    expect(decodeTruck(`platform=duramax&${'x'.repeat(400)}`)).toBeNull();
  });
});

describe('return path', () => {
  test('keeps an internal path', () => {
    expect(safeReturnPath('/store/products?platform=duramax')).toBe('/store/products?platform=duramax');
    expect(safeReturnPath('/store/products/ddp-cp3#fit')).toBe('/store/products/ddp-cp3#fit');
  });

  test('refuses anything that leaves the site', () => {
    expect(safeReturnPath('//evil.example')).toBe('/store/products');
    expect(safeReturnPath('https://evil.example')).toBe('/store/products');
    expect(safeReturnPath('/store\\@evil.example')).toBe('/store/products');
    expect(safeReturnPath('/store\nSet-Cookie: x=1')).toBe('/store/products');
    expect(safeReturnPath(undefined)).toBe('/store/products');
    expect(safeReturnPath('/x', '/store')).toBe('/x');
  });
});
