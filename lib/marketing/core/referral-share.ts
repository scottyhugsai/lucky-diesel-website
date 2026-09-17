/** Pure helpers for the "Refer a friend" prompt. Safe on client and server. */

export interface ReferralShare {
  /** The customer's personal code, or null for a generic share. */
  code: string | null;
  /** Absolute URL to share. */
  url: string;
  /** Referee discount in cents; 0 hides the offer line. */
  discountCents: number;
}

const GENERIC_UTM = 'utm_source=referral&utm_medium=share&utm_campaign=refer-a-friend';

function wholeDollars(cents: number): string {
  return `$${Math.floor(Math.max(0, cents) / 100)}`;
}

/** Personal link when a code exists, else the home page tagged as a word-of-mouth share. */
export function referralShareUrl(origin: string, code: string | null): string {
  const base = origin.replace(/\/$/, '');
  return code ? `${base}/refer/${encodeURIComponent(code)}` : `${base}/?${GENERIC_UTM}`;
}

/** Short text for the native share sheet / SMS. */
export function referralShareText(share: Pick<ReferralShare, 'code' | 'discountCents'>, businessName: string): string {
  if (share.code && share.discountCents > 0) {
    return `I use ${businessName} for my truck. This link takes ${wholeDollars(share.discountCents)} off your first job:`;
  }
  return `I use ${businessName} for my truck. Worth a look:`;
}

/** One-line headline for the prompt. */
export function referralHeadline(share: Pick<ReferralShare, 'code' | 'discountCents'>): string {
  if (share.code && share.discountCents > 0) return `Give ${wholeDollars(share.discountCents)}, get rewarded`;
  return 'Know a diesel owner?';
}
