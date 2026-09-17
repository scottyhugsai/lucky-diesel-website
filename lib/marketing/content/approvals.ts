import { createHash } from 'node:crypto';
import type { ComplianceStatus } from './types';

/**
 * The approval state machine. Nothing reaches a platform unless an approval
 * row matches a hash of the exact payload being published; editing the
 * content after approval invalidates it.
 */

export type ContentStatus =
  | 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'live' | 'published'
  | 'paused' | 'completed' | 'rejected' | 'archived' | 'failed';

const TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  draft: ['pending_approval', 'archived'],
  pending_approval: ['approved', 'rejected', 'draft'],
  approved: ['scheduled', 'live', 'published', 'draft', 'archived'],
  scheduled: ['live', 'published', 'paused', 'failed', 'draft'],
  live: ['paused', 'completed'],
  paused: ['live', 'completed', 'archived'],
  published: ['archived'],
  failed: ['scheduled', 'draft'],
  rejected: ['draft', 'archived'],
  completed: ['archived'],
  archived: [],
};

export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: ContentStatus): readonly ContentStatus[] {
  return TRANSITIONS[from];
}

/** Returns the new status or throws with a readable reason. */
export function transition(from: ContentStatus, to: ContentStatus): ContentStatus {
  if (!canTransition(from, to)) throw new Error(`Can’t move from ${from.replace('_', ' ')} to ${to.replace('_', ' ')}.`);
  return to;
}

/** JSON with sorted keys, so logically equal payloads hash the same. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

export function payloadHash(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

export type ApprovalDecision = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface ApprovalRecord {
  decision: ApprovalDecision;
  payloadHash: string;
  decidedBy: string | null;
  decidedAt: string | null;
}

/** An approval only counts if it was approved by someone, for this exact payload. */
export function isApprovalValid(approval: ApprovalRecord | null | undefined, payload: unknown): boolean {
  return Boolean(approval && approval.decision === 'approved' && approval.decidedBy && approval.decidedAt && approval.payloadHash === payloadHash(payload));
}

/** Status a decision moves the subject to. */
export function statusAfterDecision(decision: Exclude<ApprovalDecision, 'pending'>): ContentStatus {
  return decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'draft';
}

export interface PublishGate {
  status: ContentStatus;
  approval: ApprovalRecord | null;
  payload: unknown;
  compliance: ComplianceStatus;
  /** The owner ticked "I checked the warnings" when approving. */
  warningsAcknowledged: boolean;
}

export function canPublish(gate: PublishGate): { ok: true } | { ok: false; reason: string } {
  if (gate.compliance === 'block') return { ok: false, reason: 'Compliance check blocked this content.' };
  if (gate.compliance === 'warn' && !gate.warningsAcknowledged) return { ok: false, reason: 'Compliance warnings need the owner’s confirmation.' };
  if (!['approved', 'scheduled', 'paused'].includes(gate.status)) return { ok: false, reason: `Content is ${gate.status.replace('_', ' ')}, not approved.` };
  if (!isApprovalValid(gate.approval, gate.payload)) return { ok: false, reason: 'No valid approval for this exact version. Re-approve after edits.' };
  return { ok: true };
}

/** An approval decision must be allowed from the current status. */
export function decide(current: ContentStatus, decision: Exclude<ApprovalDecision, 'pending'>, compliance: ComplianceStatus): ContentStatus {
  if (current !== 'pending_approval') throw new Error('Only content waiting for approval can be decided.');
  if (decision === 'approved' && compliance === 'block') throw new Error('Blocked content can’t be approved. Edit it first.');
  return transition(current, statusAfterDecision(decision));
}
