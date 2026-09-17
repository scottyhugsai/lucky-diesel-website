/** Pipelines and their default stages. Pure: used by the page, the service and tests. */

export type PipelineId = 'leads' | 'builds' | 'fleet';

export interface StageDefinition {
  key: string;
  name: string;
  weight: number;
}

export interface PipelineDefinition {
  id: PipelineId;
  label: string;
  stages: readonly StageDefinition[];
}

/**
 * Keys that match a lead status (new, contacted, booked, won, lost) stay in sync
 * with it in the database; `quoted` and `in_shop` move automatically from job status.
 */
export const PIPELINES: readonly PipelineDefinition[] = [
  {
    id: 'leads', label: 'Service',
    stages: [
      { key: 'new', name: 'New', weight: 10 }, { key: 'contacted', name: 'Contacted', weight: 20 }, { key: 'quoted', name: 'Quoted', weight: 40 },
      { key: 'booked', name: 'Booked', weight: 70 }, { key: 'in_shop', name: 'In shop', weight: 85 }, { key: 'won', name: 'Won', weight: 100 }, { key: 'lost', name: 'Lost', weight: 0 },
    ],
  },
  {
    id: 'builds', label: 'Builds',
    stages: [
      { key: 'new', name: 'New', weight: 10 }, { key: 'contacted', name: 'Consult', weight: 25 }, { key: 'quoted', name: 'Build quote', weight: 45 },
      { key: 'booked', name: 'Deposit', weight: 75 }, { key: 'in_shop', name: 'In build', weight: 90 }, { key: 'won', name: 'Delivered', weight: 100 }, { key: 'lost', name: 'Lost', weight: 0 },
    ],
  },
  {
    id: 'fleet', label: 'Fleet',
    stages: [
      { key: 'new', name: 'New', weight: 10 }, { key: 'contacted', name: 'Intro call', weight: 20 }, { key: 'quoted', name: 'Proposal', weight: 45 },
      { key: 'booked', name: 'Trial job', weight: 70 }, { key: 'in_shop', name: 'In shop', weight: 85 }, { key: 'won', name: 'Account', weight: 100 }, { key: 'lost', name: 'Lost', weight: 0 },
    ],
  },
];

export const DEFAULT_PIPELINE: PipelineId = 'leads';

export function isPipelineId(value: unknown): value is PipelineId {
  return typeof value === 'string' && PIPELINES.some((p) => p.id === value);
}

export function pipelineDefinition(id: PipelineId): PipelineDefinition {
  return PIPELINES.find((p) => p.id === id) ?? PIPELINES[0]!;
}

/** Rows to insert for the stages a pipeline is missing (by key). */
export function missingStageRows(id: PipelineId, existingKeys: readonly string[]): { pipeline: PipelineId; key: string; name: string; sort: number; score_weight: number; is_won: boolean; is_lost: boolean }[] {
  const have = new Set(existingKeys);
  return pipelineDefinition(id).stages.flatMap((stage, sort) =>
    have.has(stage.key) ? [] : [{ pipeline: id, key: stage.key, name: stage.name, sort, score_weight: stage.weight, is_won: stage.key === 'won', is_lost: stage.key === 'lost' }],
  );
}

export const LOST_REASONS = ['Price', 'Timing', 'Went elsewhere', 'No response', 'Not a fit'] as const;
export type LostReason = (typeof LOST_REASONS)[number];

/** Dollars typed by the owner ("2,500", "$2500.50") → cents, or null when invalid. */
export function parseDealValue(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!cleaned) return 0;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
