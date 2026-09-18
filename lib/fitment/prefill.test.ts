import { describe, expect, test } from 'vitest';
import { truckPrefill } from './prefill';
import { EMPTY_FITMENT } from './select';
import { truckFromFitment, truckFromSelection } from './truck-cookie';

describe('truckPrefill', () => {
  test('turns a saved pick into the fields the forms ask for', () => {
    const saved = truckFromFitment({ year: 2016, make: 'ram', model: 'ram-2500', engine: 'ram-6-7-cummins' });
    expect(saved).not.toBeNull();
    const pre = truckPrefill(saved);
    expect(pre.platform).toBe('cummins');
    // The forms show a human label, not the Shopify collection handle.
    expect(pre.generation).toBe('2013–2018 6.7L');
  });

  test('carries a platform-only pick without inventing a generation', () => {
    const pre = truckPrefill(truckFromSelection('duramax', null));
    expect(pre).toEqual({ platform: 'duramax', generation: '' });
  });

  test('maps the collection handle to its matching label by position', () => {
    const pre = truckPrefill(truckFromSelection('duramax', 'duramax-2017-present-l5p'));
    expect(pre.platform).toBe('duramax');
    expect(pre.generation).toBe('2017–Present L5P 6.6L');
  });

  test('says nothing when no truck is saved', () => {
    expect(truckPrefill(null)).toEqual({ platform: '', generation: '' });
  });

  test('ignores a generation the platform does not have', () => {
    const pre = truckPrefill({ fitment: EMPTY_FITMENT, selection: { platform: 'duramax', generationCollection: 'powerstroke-2011-2019-6-7l' } });
    expect(pre).toEqual({ platform: 'duramax', generation: '' });
  });
});
