import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { MISSING_FACTS, factsBySeverity, stalefacts } from './site-facts';
import { BUSINESS } from './site';

describe('the facts the owner still owes us', () => {
  test('every entry is answerable: a label, what it blocks, and where to get it', () => {
    for (const fact of MISSING_FACTS) {
      expect(fact.label.length, fact.id).toBeGreaterThan(4);
      expect(fact.blocks.length, fact.id).toBeGreaterThan(20);
      expect(fact.where.length, fact.id).toBeGreaterThan(10);
    }
  });

  test('ids are unique, so the generated document cannot list one twice', () => {
    expect(new Set(MISSING_FACTS.map((f) => f.id)).size).toBe(MISSING_FACTS.length);
  });

  // The failure this guards against: the owner supplies the address, someone
  // adds it to BUSINESS, and the document keeps asking for it for weeks.
  test('nothing is still being asked for that BUSINESS already has', () => {
    expect(stalefacts()).toEqual([]);
  });

  test('the keys it claims to fill really are absent today', () => {
    const known = BUSINESS as unknown as Record<string, unknown>;
    for (const fact of MISSING_FACTS) {
      if (fact.businessKey) expect(known[fact.businessKey], fact.id).toBeUndefined();
    }
  });

  test('something blocks launch, or the list has stopped being a launch list', () => {
    expect(factsBySeverity('blocks-launch').length).toBeGreaterThan(0);
  });
});

describe('the document the owner actually reads', () => {
  const doc = readFileSync(new URL('../BUSINESS_FACTS_NEEDED.md', import.meta.url), 'utf8');

  // Generated, so it can only drift if someone edits the registry and forgets
  // to run the script. This is the check that catches that, in CI.
  test('names every outstanding fact', () => {
    for (const fact of MISSING_FACTS) expect(doc, fact.id).toContain(fact.label);
  });

  test('asks for nothing that is no longer outstanding', () => {
    const headings = [...doc.matchAll(/^### (.+)$/gm)].map((match) => match[1]);
    expect(headings.sort()).toEqual(MISSING_FACTS.map((fact) => fact.label).sort());
  });

  test('says it is generated, so nobody hand-edits it', () => {
    expect(doc).toContain('scripts/facts.mjs');
  });
});
