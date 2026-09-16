'use client';

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { moveLine, removeLine, saveLine, setAllPending } from '@/app/admin/jobs/[id]/lines/actions';
import { Badge, buttonClass, fieldClass } from '@/components/app/ui';
import type { Enums, Tables } from '@/lib/db/database.types';
import { money } from '@/lib/format';
import { lineAmount } from '@/lib/work-orders/totals';
import { ActionForm, PendingButton } from './ActionForm';
import { LineTotals } from './LineTotals';

type Line = Tables<'line_items'>;
type Kind = Enums<'line_item_kind'>;

interface EditorProps {
  workOrderId: string;
  lines: Line[];
  locked: boolean;
  taxRate: number;
  laborRateCents: number;
  partsTaxable: boolean;
  laborTaxable: boolean;
}

const KIND_LABEL: Record<Kind, string> = { labor: 'Labor', part: 'Part', fee: 'Fee' };
const APPROVAL_TONE = { pending: 'warn', approved: 'good', declined: 'bad' } as const;
const smallField = `${fieldClass} h-10 text-sm`;
const toDollars = (cents: number | null) => (cents === null ? '' : (cents / 100).toFixed(2));

function LineFields({ workOrderId, line, defaults, onDone }: { workOrderId: string; line?: Line; defaults: Pick<EditorProps, 'laborRateCents' | 'partsTaxable' | 'laborTaxable'>; onDone?: () => void }) {
  const [kind, setKind] = useState<Kind>(line?.kind ?? 'part');
  const [quantity, setQuantity] = useState(String(line?.quantity ?? 1));
  const [price, setPrice] = useState(line ? toDollars(line.unit_price_cents) : '');
  const [cost, setCost] = useState(line ? toDollars(line.unit_cost_cents) : '');
  const [taxable, setTaxable] = useState(line?.taxable ?? defaults.partsTaxable);

  function changeKind(next: Kind) {
    setKind(next);
    if (line) return;
    if (next === 'labor') {
      setPrice(toDollars(defaults.laborRateCents));
      setTaxable(defaults.laborTaxable);
    } else {
      if (kind === 'labor') setPrice('');
      setTaxable(defaults.partsTaxable);
    }
  }

  const qty = Number(quantity) || 0;
  const amount = Math.round(qty * (Number(price.replace(/[$,]/g, '')) || 0) * 100);
  const profit = cost === '' ? null : amount - Math.round(qty * (Number(cost.replace(/[$,]/g, '')) || 0) * 100);

  return (
    <ActionForm action={saveLine} resetOnSuccess={!line} onSuccess={onDone} className="grid grid-cols-2 gap-3 rounded-sm border border-clover/30 bg-carbon p-3 sm:grid-cols-12" aria-label={line ? 'Edit line' : 'Add line'}>
      <input type="hidden" name="work_order_id" value={workOrderId} />
      {line && <input type="hidden" name="line_id" value={line.id} />}
      <label className="col-span-2 sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-steel">Type</span>
        <select name="kind" value={kind} onChange={(e) => changeKind(e.target.value as Kind)} className={smallField}>
          <option value="part">Part</option><option value="labor">Labor</option><option value="fee">Fee</option>
        </select>
      </label>
      <label className="col-span-2 sm:col-span-10"><span className="mb-1 block text-xs font-semibold text-steel">Description</span>
        <input name="description" required maxLength={200} defaultValue={line?.description} className={smallField} placeholder={kind === 'labor' ? 'e.g. Turbo R&R' : 'e.g. DDP 66mm Stage 2 turbocharger'} />
      </label>
      <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-steel">{kind === 'labor' ? 'Hours' : 'Qty'}</span>
        <input name="quantity" inputMode="decimal" required value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${smallField} tabular-nums`} />
      </label>
      <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-steel">{kind === 'labor' ? 'Rate $' : 'Unit price $'}</span>
        <input name="unit_price" inputMode="decimal" required value={price} onChange={(e) => setPrice(e.target.value)} className={`${smallField} tabular-nums`} />
      </label>
      <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-steel">Unit cost $</span>
        <input name="unit_cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder={kind === 'labor' ? 'n/a' : ''} className={`${smallField} tabular-nums`} />
      </label>
      <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-steel">Approval</span>
        <select name="approval" defaultValue={line?.approval ?? 'pending'} className={smallField}>
          <option value="pending">Pending</option><option value="approved">Approved</option><option value="declined">Declined</option>
        </select>
      </label>
      <label className="flex items-center gap-2 self-end pb-2.5 text-sm sm:col-span-2">
        <input type="checkbox" name="taxable" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} className="size-4 accent-[var(--clover)]" /> Taxable
      </label>
      <div className="self-end pb-2.5 text-right text-sm tabular-nums sm:col-span-2">
        <span className="block font-bold">{money(amount)}</span>
        {profit !== null && <span className={`block text-xs ${profit < 0 ? 'text-danger' : 'text-clover'}`}>{money(profit)} profit</span>}
      </div>
      <div className="col-span-2 flex flex-wrap justify-end gap-2 sm:col-span-12">
        {onDone && line && <button type="button" onClick={onDone} className={buttonClass('ghost', 'sm')}><X className="size-4" aria-hidden="true" />Cancel</button>}
        <PendingButton size="sm">{line ? 'Save line' : <><Plus className="size-4" aria-hidden="true" />Add line</>}</PendingButton>
      </div>
    </ActionForm>
  );
}

function IconAction({ action, fields, label, children, danger = false, confirm, disabled = false }: { action: typeof moveLine; fields: Record<string, string>; label: string; children: React.ReactNode; danger?: boolean; confirm?: string; disabled?: boolean }) {
  return (
    <ActionForm action={action} confirm={confirm} feedback="none">
      {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <PendingButton variant="ghost" size="sm" aria-label={label} title={label} disabled={disabled} className={`!h-8 !w-8 !px-0 ${danger ? 'hover:!text-danger' : ''}`}>{children}</PendingButton>
    </ActionForm>
  );
}

function LineRow({ line, index, count, props }: { line: Line; index: number; count: number; props: EditorProps }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <li><LineFields workOrderId={props.workOrderId} line={line} defaults={props} onDone={() => setEditing(false)} /></li>;

  const amount = lineAmount(line);
  const profit = line.unit_cost_cents === null ? null : amount - Math.round(Number(line.quantity) * line.unit_cost_cents);
  const base = { work_order_id: props.workOrderId, line_id: line.id };

  return (
    <li className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_7.5rem_6.5rem_7.5rem_auto] sm:items-center ${line.approval === 'declined' ? 'opacity-55' : ''}`}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-steel">{KIND_LABEL[line.kind]}</span>
          <Badge tone={APPROVAL_TONE[line.approval]}>{line.approval}</Badge>
          {!line.taxable && <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-steel">non-tax</span>}
        </p>
        <p className={`mt-1 font-semibold leading-snug ${line.approval === 'declined' ? 'line-through decoration-steel' : ''}`}>{line.description}</p>
      </div>
      <p className="text-right font-bold tabular-nums sm:order-3">{money(amount)}</p>
      <p className="text-sm tabular-nums text-chalk/70 sm:order-2 sm:text-right">{Number(line.quantity)} × {money(line.unit_price_cents)}</p>
      <p className="text-right text-xs tabular-nums sm:order-4">
        <span className={`block font-semibold ${profit === null ? 'text-steel' : profit < 0 ? 'text-danger' : 'text-clover'}`}>{profit === null ? (line.kind === 'labor' ? 'Labor' : 'No cost') : `${money(profit)} profit`}</span>
        {line.unit_cost_cents !== null && <span className="block text-steel">cost {money(line.unit_cost_cents)}/ea</span>}
      </p>
      {!props.locked && (
        <div className="col-span-2 flex justify-end gap-0.5 sm:order-5 sm:col-span-1">
          <IconAction action={moveLine} fields={{ ...base, direction: 'up' }} label="Move up" disabled={index === 0}><ArrowUp className="size-4" /></IconAction>
          <IconAction action={moveLine} fields={{ ...base, direction: 'down' }} label="Move down" disabled={index === count - 1}><ArrowDown className="size-4" /></IconAction>
          <button type="button" onClick={() => setEditing(true)} className={`${buttonClass('ghost', 'sm')} !h-8 !w-8 !px-0`} aria-label="Edit line" title="Edit line"><Pencil className="size-4" /></button>
          <IconAction action={removeLine} fields={base} label="Remove line" danger confirm={`Remove “${line.description}”?`}><Trash2 className="size-4" /></IconAction>
        </div>
      )}
    </li>
  );
}

export function LineItemsEditor(props: EditorProps) {
  const { lines, locked, workOrderId, taxRate } = props;
  const pending = lines.filter((l) => l.approval === 'pending').length;
  return (
    <div className="grid gap-5">
      {lines.length ? (
        <ol className="divide-y divide-line">
          {lines.map((line, index) => <LineRow key={line.id} line={line} index={index} count={lines.length} props={props} />)}
        </ol>
      ) : (
        <p className="rounded-sm border border-dashed border-line p-6 text-center text-sm text-steel">No lines yet. Add parts, labor and fees below.</p>
      )}

      {!locked && pending > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-sm border border-amber-400/25 bg-amber-400/5 p-3 text-sm">
          <span className="mr-auto text-amber-200">{pending} line{pending === 1 ? '' : 's'} pending. Customer approved in person or by phone?</span>
          <ActionForm action={setAllPending} className="flex flex-wrap gap-2" confirm="Record the customer’s decision on every pending line?">
            <input type="hidden" name="work_order_id" value={workOrderId} />
            <PendingButton size="sm" variant="secondary" name="approval" value="approved">Approve all pending</PendingButton>
            <PendingButton size="sm" variant="ghost" name="approval" value="declined">Decline all</PendingButton>
          </ActionForm>
        </div>
      )}

      {!locked && <LineFields workOrderId={workOrderId} defaults={props} />}
      {locked && <p className="text-sm text-steel">Lines are locked because this job has been invoiced.</p>}

      <LineTotals lines={lines} taxRate={taxRate} />
    </div>
  );
}
