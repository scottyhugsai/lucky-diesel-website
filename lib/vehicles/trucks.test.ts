import { describe, expect, it } from 'vitest';
import { PLATFORMS } from '@/lib/site';
import { TRUCKS, findTruck, truckLabel, trucksForGeneration } from './index';

const COLLECTIONS = new Set(PLATFORMS.flatMap((platform) => platform.generationCollections));
const generations = TRUCKS.flatMap((truck) => truck.generations.map((generation) => ({ truck, generation })));

describe('TRUCKS', () => {
  it('covers the four makes and the 1500 through 4500 classes', () => {
    expect(new Set(TRUCKS.map((t) => t.make))).toEqual(new Set(['ford', 'ram', 'chevrolet', 'gmc']));
    for (const make of ['ford', 'ram', 'chevrolet', 'gmc'] as const) {
      const classes = TRUCKS.filter((t) => t.make === make).map((t) => t.class);
      expect(new Set(classes)).toEqual(new Set(['1500', '2500', '3500', '4500']));
    }
  });

  it('gives every model a unique id', () => {
    expect(new Set(TRUCKS.map((t) => t.id)).size).toBe(TRUCKS.length);
  });

  it('starts every generation at 2001 or later', () => {
    for (const { generation } of generations) expect(generation.yearFrom).toBeGreaterThanOrEqual(2001);
  });

  it('never ends a generation before it starts', () => {
    for (const { generation } of generations) {
      if (generation.yearTo !== null) expect(generation.yearTo).toBeGreaterThanOrEqual(generation.yearFrom);
    }
  });

  it('gives every generation at least one engine', () => {
    for (const { truck, generation } of generations) {
      expect(generation.engines.length, `${truck.id} ${generation.id}`).toBeGreaterThan(0);
    }
  });

  it('does not overlap generations within a model', () => {
    for (const truck of TRUCKS) {
      const ordered = [...truck.generations].sort((a, b) => a.yearFrom - b.yearFrom);
      ordered.forEach((generation, index) => {
        const next = ordered[index + 1];
        if (!next) return;
        expect(generation.yearTo, `${truck.id} ${generation.id}`).not.toBeNull();
        expect(generation.yearTo ?? Infinity).toBeLessThan(next.yearFrom);
      });
    }
  });

  it('uses generation ids that are unique inside a model', () => {
    for (const truck of TRUCKS) {
      expect(new Set(truck.generations.map((g) => g.id)).size).toBe(truck.generations.length);
    }
  });

  it('only points at generation collections the shop actually has', () => {
    for (const { generation } of generations) {
      if (generation.generationCollection) expect(COLLECTIONS.has(generation.generationCollection)).toBe(true);
    }
  });

  it('only maps a generation collection onto a generation with that platform of diesel', () => {
    for (const { generation } of generations) {
      const handle = generation.generationCollection;
      if (!handle) continue;
      const platforms = generation.engines.map((engine) => engine.platform).filter((p): p is NonNullable<typeof p> => p !== null);
      expect(platforms.some((platform) => handle.startsWith(`${platform}-`))).toBe(true);
    }
  });

  it('marks gas engines as having no diesel platform', () => {
    for (const { generation } of generations) {
      for (const engine of generation.engines) {
        if (engine.fuel === 'gas') expect(engine.platform).toBeNull();
      }
    }
  });
});

describe('findTruck', () => {
  it('finds a model by id', () => {
    expect(findTruck('ford-f-250')?.model).toBe('F-250');
  });

  it('returns null for an unknown id', () => {
    expect(findTruck('ford-ranger')).toBeNull();
  });
});

describe('truckLabel', () => {
  it('calls a pre-2011 Ram a Dodge Ram', () => {
    const ram = findTruck('ram-2500');
    const generation = ram?.generations.find((g) => g.id === 'ramhd-2003-2007');
    expect(ram && generation ? truckLabel(ram, generation) : '').toBe('Dodge Ram 2500');
  });

  it('calls a later Ram a Ram', () => {
    const ram = findTruck('ram-2500');
    const generation = ram?.generations.find((g) => g.id === 'ramhd-2019');
    expect(ram && generation ? truckLabel(ram, generation) : '').toBe('Ram 2500');
  });
});

describe('the trucks behind one engine generation', () => {
  it('lists every model that shipped with an LML, newest badge first', () => {
    const fitted = trucksForGeneration('duramax-2011-2016-lml');
    expect(fitted.length).toBeGreaterThan(0);
    for (const entry of fitted) {
      expect(entry.yearFrom).toBeGreaterThanOrEqual(2011);
      expect(entry.engines.length).toBeGreaterThan(0);
    }
    expect(fitted.map((f) => f.name)).toContain('Chevrolet Silverado 2500HD');
    expect(fitted.map((f) => f.name)).toContain('GMC Sierra 3500HD');
  });

  it('carries the Dodge badge on a Ram generation that predates 2011', () => {
    const fitted = trucksForGeneration('cummins-2003-2007-5-9l-common-rail');
    expect(fitted.every((f) => f.name.startsWith('Dodge Ram'))).toBe(true);
  });

  it('names only the engines that belong to the generation, not the gas options', () => {
    for (const entry of trucksForGeneration('powerstroke-2020-2022-6-7l')) {
      for (const engine of entry.engines) expect(engine.toLowerCase()).toContain('6.7');
    }
  });

  it('returns nothing for a handle no truck carries', () => {
    expect(trucksForGeneration('not-a-collection')).toEqual([]);
    expect(trucksForGeneration('')).toEqual([]);
  });

  /**
   * A generation only earns its own page if this list is non-empty — otherwise
   * the page is a heading with nothing underneath it. TRUCKS starts at the 2001
   * model year, so the two 12-valve Cummins generations that ended before then
   * have no entry and deliberately get no page; their cards still link to the
   * filtered parts listing. Pinned here so the set cannot drift unnoticed.
   */
  it('names trucks for every generation the site gives a page to', () => {
    const empty = [...COLLECTIONS].filter((collection) => trucksForGeneration(collection).length === 0);
    expect(empty.sort()).toEqual(['cummins-1989-1993-5-9l-12v', 'cummins-1994-1998-5-5-9l-12v']);
  });
});
