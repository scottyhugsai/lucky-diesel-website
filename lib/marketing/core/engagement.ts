/** Engagement signals added on top of the rule-based lead score. Pure. */

export interface EngagementSignals {
  /** Site visits and link clicks (attribution touches) in the last 30 days. */
  touches: number;
  /** Store checkout clicks in the last 30 days. */
  checkoutClicks: number;
  /** Texts or emails the customer sent us in the last 30 days. */
  inboundMessages: number;
  /** Campaign emails/texts clicked in the last 30 days. */
  campaignClicks: number;
}

export const MAX_ENGAGEMENT_POINTS = 20;

export function engagementPoints(signals: EngagementSignals): number {
  const points = Math.min(signals.touches, 5) * 2 + Math.min(signals.checkoutClicks, 2) * 4 + Math.min(signals.inboundMessages, 3) * 3 + Math.min(signals.campaignClicks, 3) * 2;
  return Math.min(MAX_ENGAGEMENT_POINTS, points);
}

/** Base score plus engagement, capped at 100. Booked/won (100) and lost (0) stay pinned. */
export function withEngagement(baseScore: number, status: string, signals: EngagementSignals): number {
  if (status !== 'new' && status !== 'contacted') return baseScore;
  return Math.max(0, Math.min(100, baseScore + engagementPoints(signals)));
}

export const NO_ENGAGEMENT: EngagementSignals = { touches: 0, checkoutClicks: 0, inboundMessages: 0, campaignClicks: 0 };
