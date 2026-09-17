import type { ClaimIssue } from './types';

/**
 * Media release and endorsement rules (FTC endorsement guides):
 * - a customer's photo, name or words need a release on file that covers them;
 * - anyone who got something for it (discount, gift, free work) must be
 *   disclosed clearly in the post (#ad or "paid partnership").
 * Pure: services load the releases and act on the result.
 */

export type MediaNeed = 'truck' | 'plate' | 'face' | 'name' | 'testimonial';

export interface ReleaseScope {
  truck: boolean;
  plate: boolean;
  face: boolean;
  name: boolean;
  testimonial: boolean;
  incentivized: boolean;
  revokedAt: string | null;
}

export function releaseFromRow(row: { allow_truck: boolean; allow_plate: boolean; allow_face: boolean; allow_name: boolean; allow_testimonial: boolean; incentivized: boolean; revoked_at: string | null }): ReleaseScope {
  return { truck: row.allow_truck, plate: row.allow_plate, face: row.allow_face, name: row.allow_name, testimonial: row.allow_testimonial, incentivized: row.incentivized, revokedAt: row.revoked_at };
}

/** True when one active release covers every need. */
export function releaseCovers(releases: readonly ReleaseScope[], needs: readonly MediaNeed[]): boolean {
  return releases.some((r) => !r.revokedAt && needs.every((need) => r[need]));
}

/** Plates and faces may stay unblurred only with a release that covers both. */
export function privacyClearedByRelease(releases: readonly ReleaseScope[]): boolean {
  return releaseCovers(releases, ['truck', 'plate', 'face']);
}

export function anyIncentivized(releases: readonly ReleaseScope[]): boolean {
  return releases.some((r) => !r.revokedAt && r.incentivized);
}

const DISCLOSURE = /(^|\s)#(ad|sponsored|paidpartnership)\b|paid partnership/i;

export function hasDisclosure(caption: string): boolean {
  return DISCLOSURE.test(caption);
}

export interface EndorsementInput {
  caption: string;
  /** The post shows a customer's photo, name or words. */
  customerContent: boolean;
  needs: readonly MediaNeed[];
  releases: readonly ReleaseScope[];
}

/** Blocking issues for a post that features a customer. Empty when nothing applies. */
export function checkEndorsement(input: EndorsementInput): ClaimIssue[] {
  if (!input.customerContent) return [];
  const issues: ClaimIssue[] = [];
  if (!releaseCovers(input.releases, input.needs)) {
    issues.push({ term: 'Media release', reason: `No active release covers ${input.needs.join(', ')}. Add one under Social › Releases.`, severity: 'block' });
  }
  const active = input.releases.filter((r) => !r.revokedAt);
  if (anyIncentivized(active) && !hasDisclosure(input.caption)) {
    issues.push({ term: '#ad', reason: 'They got something for this. Add #ad to the caption.', severity: 'block' });
  }
  return issues;
}
