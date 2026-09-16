import { describe, expect, test } from 'vitest';
import { computeTotals, lineAmount, totalsByApproval, type TotalsLine } from './totals';

const labor: TotalsLine = { kind: 'labor', quantity: 2.5, unit_price_cents: 16500, taxable: false, approval: 'approved' };
const turbo: TotalsLine = { kind: 'part', quantity: 1, unit_price_cents: 279500, unit_cost_cents: 220000, taxable: true, approval: 'approved' };
const filter: TotalsLine = { kind: 'part', quantity: 2, unit_price_cents: 4999, taxable: true, approval: 'declined' };

describe('computeTotals', () => {
  test('taxes only taxable lines', () => {
    const totals = computeTotals([labor, turbo], 0.09);

    expect(totals.subtotalCents).toBe(41250 + 279500);
    expect(totals.taxCents).toBe(25155);
    expect(totals.totalCents).toBe(41250 + 279500 + 25155);
    expect(totals.laborCents).toBe(41250);
    expect(totals.partsCents).toBe(279500);
    expect(totals.costCents).toBe(220000);
  });

  test('handles fractional quantities without float drift', () => {
    expect(lineAmount({ quantity: 0.1, unit_price_cents: 3 })).toBe(0);
    expect(lineAmount({ quantity: 1.5, unit_price_cents: 16500 })).toBe(24750);
  });

  test('is zero for no lines', () => {
    expect(computeTotals([], 0.09).totalCents).toBe(0);
  });
});

describe('totalsByApproval', () => {
  test('splits approved, pending and declined', () => {
    const split = totalsByApproval([labor, turbo, filter], 0.09);

    expect(split.declined.subtotalCents).toBe(9998);
    expect(split.pending.totalCents).toBe(0);
    expect(split.all.subtotalCents).toBe(41250 + 279500 + 9998);
  });
});
