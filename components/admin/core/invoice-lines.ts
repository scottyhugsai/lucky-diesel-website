import type { Json } from '@/lib/db/database.types';

export interface InvoiceLine {
  kind: 'labor' | 'part' | 'fee';
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxable: boolean;
}

const KINDS = new Set(['labor', 'part', 'fee']);

/** `invoices.line_snapshot` is frozen JSON; validate each row rather than trusting its shape. */
export function parseInvoiceLines(snapshot: Json): InvoiceLine[] {
  if (!Array.isArray(snapshot)) return [];
  return snapshot.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const row = raw as Record<string, Json | undefined>;
    const quantity = Number(row.quantity);
    const unitPriceCents = Number(row.unit_price_cents);
    if (typeof row.description !== 'string' || !Number.isFinite(quantity) || !Number.isFinite(unitPriceCents)) return [];
    return [{
      kind: typeof row.kind === 'string' && KINDS.has(row.kind) ? (row.kind as InvoiceLine['kind']) : 'part',
      description: row.description,
      quantity,
      unitPriceCents,
      taxable: row.taxable !== false,
    }];
  });
}
