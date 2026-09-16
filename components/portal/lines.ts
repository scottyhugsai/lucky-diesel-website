import type { Enums, Json } from '@/lib/db/database.types';

/** The line fields the portal shows. Matches both `line_items` rows and invoice `line_snapshot` entries. */
export interface PortalLine {
  id: string;
  kind: Enums<'line_item_kind'>;
  description: string;
  quantity: number;
  unit_price_cents: number;
  taxable: boolean;
  approval: Enums<'approval_state'>;
  inspection_item_id: string | null;
}

const KINDS = new Set(['labor', 'part', 'fee']);
const APPROVALS = new Set(['pending', 'approved', 'declined']);

function toLine(value: Json, index: number): PortalLine | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { id, kind, description, quantity, unit_price_cents, taxable, approval, inspection_item_id } = value;
  const qty = Number(quantity);
  const price = Number(unit_price_cents);
  if (typeof description !== 'string' || !Number.isFinite(qty) || !Number.isInteger(price)) return null;
  return {
    id: typeof id === 'string' ? id : `snapshot-${index}`,
    kind: typeof kind === 'string' && KINDS.has(kind) ? (kind as PortalLine['kind']) : 'part',
    description,
    quantity: qty,
    unit_price_cents: price,
    taxable: taxable === true,
    approval: typeof approval === 'string' && APPROVALS.has(approval) ? (approval as PortalLine['approval']) : 'approved',
    inspection_item_id: typeof inspection_item_id === 'string' ? inspection_item_id : null,
  };
}

/** Reads an invoice's frozen line snapshot, skipping anything malformed. */
export function parseSnapshotLines(snapshot: Json): PortalLine[] {
  if (!Array.isArray(snapshot)) return [];
  return snapshot.map(toLine).filter((line): line is PortalLine => line !== null);
}

export function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/0$/, '');
}

export const KIND_LABEL: Record<PortalLine['kind'], string> = { labor: 'Labor', part: 'Part', fee: 'Fee' };
