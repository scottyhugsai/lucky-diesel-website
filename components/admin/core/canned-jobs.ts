import type { Enums } from '@/lib/db/database.types';

/** Starting points for common Lucky Diesel jobs. Labor lines are priced at the shop labor rate when applied. */

export interface CannedLine {
  kind: Enums<'line_item_kind'>;
  description: string;
  quantity: number;
  /** Parts and fees only. Labor uses `shop_settings.labor_rate_cents`. */
  unitPriceCents?: number;
  unitCostCents?: number;
}

export interface CannedJob {
  id: string;
  title: string;
  summary: string;
  lines: readonly CannedLine[];
}

export const CANNED_JOBS: readonly CannedJob[] = [
  {
    id: 'ezlynk-tune',
    title: 'EZ-Lynk performance tune',
    summary: 'ASAP/AMDP calibration, install and datalog review',
    lines: [
      { kind: 'part', description: 'ASAP EZ-Lynk engine calibration', quantity: 1, unitPriceCents: 130000, unitCostCents: 95000 },
      { kind: 'labor', description: 'Tune install & datalog review', quantity: 1.5 },
    ],
  },
  {
    id: 'ddp-stage2-turbo',
    title: 'DDP Stage 2 turbo upgrade',
    summary: '66mm drop-in, install kit, 6 hrs labor',
    lines: [
      { kind: 'part', description: 'DDP 66mm Stage 2 turbocharger', quantity: 1, unitPriceCents: 289500, unitCostCents: 231600 },
      { kind: 'part', description: 'Turbo install gasket & oil line kit', quantity: 1, unitPriceCents: 18900, unitCostCents: 11200 },
      { kind: 'labor', description: 'Turbo R&R', quantity: 6 },
    ],
  },
  {
    id: 'injector-set',
    title: 'Performance injector install',
    summary: 'Set of 8, R&R and coding',
    lines: [
      { kind: 'part', description: 'DDP performance injector set (8)', quantity: 1, unitPriceCents: 369600, unitCostCents: 295700 },
      { kind: 'labor', description: 'Injector R&R and coding', quantity: 8 },
    ],
  },
  {
    id: 'exhaust-5in',
    title: '5" stainless exhaust',
    summary: 'Downpipe-back system and install',
    lines: [
      { kind: 'part', description: '5" stainless downpipe-back exhaust', quantity: 1, unitPriceCents: 70000, unitCostCents: 48000 },
      { kind: 'labor', description: 'Exhaust install', quantity: 2 },
    ],
  },
  {
    id: 'maintenance',
    title: 'Maintenance service',
    summary: 'Oil, filters and a once-over',
    lines: [
      { kind: 'part', description: 'Oil & filter service (10 qt 15W-40)', quantity: 1, unitPriceCents: 18500, unitCostCents: 9800 },
      { kind: 'part', description: 'Fuel filter set', quantity: 1, unitPriceCents: 12900, unitCostCents: 7100 },
      { kind: 'labor', description: 'Service labor', quantity: 1.5 },
      { kind: 'fee', description: 'Shop supplies & fluid disposal', quantity: 1, unitPriceCents: 2500, unitCostCents: 900 },
    ],
  },
  {
    id: 'diagnostics',
    title: 'Diagnostics: low power / check engine',
    summary: 'Scan, datalog and pinpoint testing',
    lines: [{ kind: 'labor', description: 'Diagnostic time & datalog analysis', quantity: 1.5 }],
  },
  {
    id: 'head-studs',
    title: 'ARP head studs',
    summary: 'Studs, gaskets, coolant, 10 hrs labor',
    lines: [
      { kind: 'part', description: 'ARP head stud kit', quantity: 1, unitPriceCents: 64900, unitCostCents: 47000 },
      { kind: 'part', description: 'Head gaskets & coolant', quantity: 1, unitPriceCents: 38900, unitCostCents: 26000 },
      { kind: 'labor', description: 'Head stud install', quantity: 10 },
    ],
  },
  {
    id: 'cp3',
    title: 'CP3 pump replacement',
    summary: 'Reman CP3, R&R and prime',
    lines: [
      { kind: 'part', description: 'Reman CP3 injection pump', quantity: 1, unitPriceCents: 89995, unitCostCents: 68000 },
      { kind: 'labor', description: 'CP3 R&R and prime', quantity: 5 },
    ],
  },
  {
    id: 'trans-tune',
    title: 'Transmission tuning',
    summary: 'TCM calibration and relearn',
    lines: [
      { kind: 'part', description: 'EZ-Lynk transmission calibration', quantity: 1, unitPriceCents: 50000, unitCostCents: 36000 },
      { kind: 'labor', description: 'Trans tune & relearn', quantity: 1 },
    ],
  },
];

export function findCannedJob(id: string | null | undefined): CannedJob | undefined {
  return CANNED_JOBS.find((job) => job.id === id);
}

/** Resolved prices for a canned job at the shop's current labor rate. */
export function cannedJobLines(job: CannedJob, laborRateCents: number) {
  return job.lines.map((line, sort) => ({
    kind: line.kind,
    description: line.description,
    quantity: line.quantity,
    unit_price_cents: line.kind === 'labor' ? laborRateCents : line.unitPriceCents ?? 0,
    unit_cost_cents: line.kind === 'labor' ? null : line.unitCostCents ?? null,
    sort,
  }));
}
