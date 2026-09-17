import { describe, expect, test } from 'vitest';
import { canPublish, canTransition, decide, isApprovalValid, payloadHash, transition, type ApprovalRecord } from './approvals';

const payload = { headline: 'Tow-ready before the trip', cta: 'BOOK_NOW', budget: 2500 };
const approved: ApprovalRecord = { decision: 'approved', payloadHash: payloadHash(payload), decidedBy: 'owner', decidedAt: '2026-09-17T12:00:00Z' };

describe('approval state machine', () => {
  test('allows the happy path and rejects skipping approval', () => {
    expect(transition('draft', 'pending_approval')).toBe('pending_approval');
    expect(canTransition('draft', 'live')).toBe(false);
    expect(canTransition('draft', 'published')).toBe(false);
    expect(canTransition('pending_approval', 'scheduled')).toBe(false);
    expect(() => transition('rejected', 'live')).toThrow();
    expect(canTransition('archived', 'draft')).toBe(false);
  });

  test('decisions only apply to pending content, and blocked content cannot be approved', () => {
    expect(decide('pending_approval', 'approved', 'pass')).toBe('approved');
    expect(decide('pending_approval', 'changes_requested', 'warn')).toBe('draft');
    expect(decide('pending_approval', 'rejected', 'block')).toBe('rejected');
    expect(() => decide('draft', 'approved', 'pass')).toThrow();
    expect(() => decide('pending_approval', 'approved', 'block')).toThrow();
  });

  test('payload hash ignores key order but catches edits', () => {
    expect(payloadHash({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(payloadHash({ a: [1, { c: 3, d: 2 }], b: 1 }));
    expect(isApprovalValid(approved, { ...payload })).toBe(true);
    expect(isApprovalValid(approved, { ...payload, budget: 9900 })).toBe(false);
    expect(isApprovalValid({ ...approved, decision: 'pending' }, payload)).toBe(false);
    expect(isApprovalValid({ ...approved, decidedBy: null }, payload)).toBe(false);
  });

  test('publishing needs approval of this exact payload and clean or acknowledged compliance', () => {
    const gate = { status: 'approved' as const, approval: approved, payload, compliance: 'pass' as const, warningsAcknowledged: false };
    expect(canPublish(gate)).toEqual({ ok: true });
    expect(canPublish({ ...gate, status: 'pending_approval' }).ok).toBe(false);
    expect(canPublish({ ...gate, payload: { ...payload, headline: 'edited' } }).ok).toBe(false);
    expect(canPublish({ ...gate, compliance: 'block' }).ok).toBe(false);
    expect(canPublish({ ...gate, compliance: 'warn' }).ok).toBe(false);
    expect(canPublish({ ...gate, compliance: 'warn', warningsAcknowledged: true }).ok).toBe(true);
    expect(canPublish({ ...gate, approval: null }).ok).toBe(false);
  });
});
