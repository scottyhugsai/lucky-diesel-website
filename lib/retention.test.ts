import { describe, expect, test } from 'vitest';
import { RETENTION } from './retention';

describe('the retention schedule', () => {
  test('every rule states what, how long, and what happens then', () => {
    for (const rule of RETENTION) {
      expect(rule.data.length, rule.data).toBeGreaterThan(8);
      expect(rule.kept.length, rule.data).toBeGreaterThan(4);
      expect(rule.then.length, rule.data).toBeGreaterThan(4);
      expect(rule.tables.length, rule.data).toBeGreaterThan(0);
    }
  });

  // Published on /privacy as a promise, so a vague one is worse than none.
  test('no rule hides behind "as long as needed"', () => {
    for (const rule of RETENTION) {
      expect(rule.kept.toLowerCase(), rule.data).not.toContain('as long as');
      expect(rule.kept.toLowerCase(), rule.data).not.toContain('necessary');
      expect(rule.kept.toLowerCase(), rule.data).not.toContain('indefinite');
    }
  });

  test('covers the tables that actually hold personal data', () => {
    const covered = new Set(RETENTION.flatMap((rule) => rule.tables));
    for (const table of ['leads', 'customers', 'partial_leads', 'contact_consent_events', 'messages']) {
      expect(covered, table).toContain(table);
    }
  });

  test('names each kind the way a customer would, not the way the table is named', () => {
    for (const rule of RETENTION) expect(rule.data, rule.data).not.toMatch(/_|\b[a-z]+_[a-z]+\b/);
  });
});
