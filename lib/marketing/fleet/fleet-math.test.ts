import { describe, expect, it } from 'vitest';
import { buildFleetReport, buildProposal, dueDateForTerms, introEmail, monthRange, parseProspectCsv, previousMonth, quarterRange, splitCsvLine } from './fleet-math';

const issued = new Date('2026-09-01T12:00:00Z');
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

describe('dueDateForTerms', () => {
  it('uses fleet terms and falls back to the retail 7 days', () => {
    expect(dueDateForTerms('net_30', issued).toISOString()).toBe('2026-10-01T12:00:00.000Z');
    expect(dueDateForTerms('net_15', issued).toISOString()).toBe('2026-09-16T12:00:00.000Z');
    expect(dueDateForTerms('due_on_receipt', issued).toISOString()).toBe(issued.toISOString());
    expect(dueDateForTerms(null, issued).toISOString()).toBe('2026-09-08T12:00:00.000Z');
    expect(dueDateForTerms('net_900', issued).toISOString()).toBe('2026-09-08T12:00:00.000Z');
  });
});

describe('parseProspectCsv', () => {
  it('reads rows, skips the header, reports bad lines and dedupes', () => {
    const { rows, errors } = parseProspectCsv('company,contact,phone,email,trucks,city\n"Acme Haul, LLC",Jo Smith,843-555-0100,JO@ACME.COM,12,Conway\n\"Acme Haul, LLC\"\nX\nBeta Tow,,123,,,\nGamma,,,,,');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: 'Acme Haul, LLC', contactName: 'Jo Smith', phone: '(843) 555-0100', email: 'jo@acme.com', truckCount: 12, city: 'Conway' });
    expect(rows[1]?.name).toBe('Gamma');
    expect(errors).toEqual(['Line 4: company name missing.', 'Line 5: bad phone.']);
  });

  it('splits quoted cells', () => {
    expect(splitCsvLine('"a ""b""",c')).toEqual(['a "b"', 'c']);
  });
});

describe('reports', () => {
  it('builds ranges', () => {
    expect(monthRange('2026-02')?.to.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(monthRange('2026-13')).toBeNull();
    expect(quarterRange(new Date('2026-08-10T00:00:00Z')).label).toBe('Q3 2026');
    expect(previousMonth(new Date('2026-01-05T00:00:00Z'))).toBe('2025-12');
  });

  it('sums units, spend, downtime and overdue balance', () => {
    const now = new Date('2026-09-20T00:00:00Z');
    const report = buildFleetReport({
      jobs: [
        { vehicleId: 'v1', createdAt: '2026-08-02T00:00:00Z', completedAt: '2026-08-04T00:00:00Z', status: 'paid', totalCents: 0 },
        { vehicleId: 'v1', createdAt: '2026-08-10T00:00:00Z', completedAt: '2026-08-11T00:00:00Z', status: 'paid', totalCents: 0 },
        { vehicleId: 'v2', createdAt: '2026-08-20T00:00:00Z', completedAt: null, status: 'cancelled', totalCents: 0 },
        { vehicleId: 'v3', createdAt: '2026-07-20T00:00:00Z', completedAt: '2026-07-21T00:00:00Z', status: 'paid', totalCents: 0 },
      ],
      invoices: [
        { id: 'a', number: 1, totalCents: 50000, status: 'paid', createdAt: '2026-08-04T00:00:00Z', dueAt: null, paidAt: '2026-08-05T00:00:00Z' },
        { id: 'b', number: 2, totalCents: 20000, status: 'open', createdAt: '2026-08-11T00:00:00Z', dueAt: '2026-09-10T00:00:00Z', paidAt: null },
        { id: 'c', number: 3, totalCents: 10000, status: 'open', createdAt: '2026-09-11T00:00:00Z', dueAt: '2026-10-10T00:00:00Z', paidAt: null },
      ],
      trucks: [{ id: 'v1', label: 'Unit 1', nextDue: '2026-10-01T00:00:00Z', overdue: false }, { id: 'v3', label: 'Unit 3', nextDue: '2027-01-01T00:00:00Z', overdue: false }],
    }, new Date('2026-08-01T00:00:00Z'), new Date('2026-09-01T00:00:00Z'), now);
    expect(report).toMatchObject({ jobs: 2, unitsServiced: 1, spendCents: 50000, avgDowntimeDays: 1.5, openBalanceCents: 30000, overdueCents: 20000 });
    expect(report.dueSoon.map((t) => t.label)).toEqual(['Unit 1']);
  });
});

describe('proposal and intro email', () => {
  it('applies the fleet labor rate and SLA', () => {
    const sections = buildProposal({ fleetName: 'Acme', contactName: null, truckCount: 8, pmDays: 90, pmMiles: 10000, terms: 'net_30', priority: true, slaHours: 24, laborDiscountPct: 10, laborRateCents: 16500 }, money);
    const text = sections.flatMap((s) => s.lines).join(' ');
    expect(text).toContain('$148.50/hr');
    expect(text).toContain('within 24 business hours');
    expect(text).toContain('Net 30');
  });

  it('includes an opt-out line', () => {
    expect(introEmail({ name: 'Acme', contactName: 'Jo Smith', truckCount: 4 }, { name: 'Lucky Diesel', phone: '1', siteUrl: 'https://x' }).body).toMatch(/Hi Jo,[\s\S]*won't email again/);
  });
});
