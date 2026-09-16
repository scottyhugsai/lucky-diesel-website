import type { Enums } from '@/lib/db/database.types';

export interface TotalsLine {
  kind: Enums<'line_item_kind'>;
  quantity: number;
  unit_price_cents: number;
  unit_cost_cents?: number | null;
  taxable: boolean;
  approval: Enums<'approval_state'>;
}

export interface Totals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  costCents: number;
  laborCents: number;
  partsCents: number;
}

export function lineAmount(line: Pick<TotalsLine, 'quantity' | 'unit_price_cents'>): number {
  return Math.round(Number(line.quantity) * line.unit_price_cents);
}

/** Sums lines; tax applies to taxable lines only. Rounds once, at the tax step. */
export function computeTotals(lines: readonly TotalsLine[], taxRate: number): Totals {
  let subtotalCents = 0;
  let taxableCents = 0;
  let costCents = 0;
  let laborCents = 0;
  let partsCents = 0;
  for (const line of lines) {
    const amount = lineAmount(line);
    subtotalCents += amount;
    if (line.taxable) taxableCents += amount;
    costCents += Math.round(Number(line.quantity) * (line.unit_cost_cents ?? 0));
    if (line.kind === 'labor') laborCents += amount;
    if (line.kind === 'part') partsCents += amount;
  }
  const taxCents = Math.round(taxableCents * taxRate);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents, costCents, laborCents, partsCents };
}

export function totalsByApproval(lines: readonly TotalsLine[], taxRate: number) {
  const pick = (state: Enums<'approval_state'>) => computeTotals(lines.filter((l) => l.approval === state), taxRate);
  return { approved: pick('approved'), pending: pick('pending'), declined: pick('declined'), all: computeTotals(lines, taxRate) };
}
