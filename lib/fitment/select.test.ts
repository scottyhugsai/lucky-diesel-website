import { describe, expect, it } from 'vitest';
import { enginesFor, makesFor, modelsFor, parseFitment, resolveFitment, YEARS } from './select';

describe('YEARS', () => {
  it('runs newest first and covers the whole matrix', () => {
    expect(YEARS[0]).toBeGreaterThanOrEqual(2025);
    expect(YEARS.at(-1)).toBe(2001);
    expect(new Set(YEARS).size).toBe(YEARS.length);
  });
});

describe('narrowing', () => {
  it('offers all four makes for a recent year', () => {
    expect(makesFor(2022).map((m) => m.id).sort()).toEqual(['chevrolet', 'ford', 'gmc', 'ram']);
  });

  it('offers only that make’s models sold in that year', () => {
    const models = modelsFor(2022, 'ford');
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((model) => model.make === 'ford')).toBe(true);
  });

  it('offers the engines that generation actually had', () => {
    const engines = enginesFor(2022, 'ford', 'ford-f-250');
    expect(engines.map((e) => e.name)).toContain('6.7L Power Stroke V8');
    // The 7.3L Power Stroke ended in 2003; it must not appear on a 2022.
    expect(engines.map((e) => e.name)).not.toContain('7.3L Power Stroke V8');
  });

  it('returns nothing for a year the model was not sold in', () => {
    expect(enginesFor(1999, 'ford', 'ford-f-250')).toEqual([]);
  });
});

describe('resolveFitment', () => {
  it('maps a diesel pick to the shop platform and its store collection', () => {
    const result = resolveFitment({ year: 2022, make: 'ford', model: 'ford-f-250', engine: 'ford-6-7-psd' });
    expect(result?.platform).toBe('powerstroke');
    expect(result?.supported).toBe(true);
    expect(result?.label).toContain('2022');
    expect(result?.label).toContain('F-250');
  });

  it('is honest when the shop does not work on that engine', () => {
    const result = resolveFitment({ year: 2022, make: 'ford', model: 'ford-f-150', engine: 'ford-5-0-coyote' });
    expect(result?.platform).toBeNull();
    expect(result?.supported).toBe(false);
  });

  it('returns null when the pick is incomplete', () => {
    expect(resolveFitment({ year: 2022, make: 'ford', model: null, engine: null })).toBeNull();
  });

  it('returns null when the engine was never in that truck', () => {
    expect(resolveFitment({ year: 2022, make: 'ford', model: 'ford-f-250', engine: 'ram-6-7-cummins' })).toBeNull();
  });
});

describe('parseFitment', () => {
  it('keeps a valid selection and drops anything that does not narrow', () => {
    expect(parseFitment({ year: '2022', make: 'ford', model: 'ford-f-250', engine: 'ford-6-7-psd' }))
      .toEqual({ year: 2022, make: 'ford', model: 'ford-f-250', engine: 'ford-6-7-psd' });
  });

  it('drops a model that does not belong to the make', () => {
    expect(parseFitment({ year: '2022', make: 'ford', model: 'chevrolet-silverado-2500hd' }))
      .toEqual({ year: 2022, make: 'ford', model: null, engine: null });
  });

  it('drops junk without throwing', () => {
    expect(parseFitment({ year: 'lol', make: '<script>', model: '../../etc', engine: '' }))
      .toEqual({ year: null, make: null, model: null, engine: null });
    expect(parseFitment({})).toEqual({ year: null, make: null, model: null, engine: null });
  });

  it('forgets the engine when the year no longer covers it', () => {
    expect(parseFitment({ year: '2005', make: 'ford', model: 'ford-f-250', engine: 'ford-6-7-psd' }).engine).toBeNull();
  });
});
