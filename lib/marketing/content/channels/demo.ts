import { hashSeed, seededRandom } from '../demo-generator';
import type { SocialPlatform } from '../types';
import type { AdAdapter, ConnectionPlatform, DailyMetrics, PostAdapter } from './types';

/**
 * Demo adapters: never call a platform. They return clearly labelled fake ids,
 * record the request they *would* have sent, and produce deterministic
 * simulated metrics so dashboards and auto-pause rules can be exercised.
 */

const AVERAGE_JOB_VALUE_CENTS = 85000;

/** Deterministic, plausible local-service metrics for one day. Always flagged simulated by callers. */
export function simulateDailyMetrics(seedKey: string, date: string, dailyBudgetCents: number): DailyMetrics {
  const random = seededRandom(hashSeed(`${seedKey}|${date}`));
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const weekendDip = weekday === 0 || weekday === 6 ? 0.8 : 1;
  const spendCents = Math.round(dailyBudgetCents * (0.82 + random() * 0.18) * weekendDip);
  const cpmCents = 900 + Math.round(random() * 900); // $9–18 CPM
  const impressions = Math.round((spendCents / cpmCents) * 1000);
  const ctr = 0.008 + random() * 0.017; // 0.8–2.5%
  const clicks = Math.round(impressions * ctr);
  const cplCents = 1800 + Math.round(random() * 2700); // $18–45 CPL
  const expectedLeads = spendCents / cplCents;
  const leads = Math.floor(expectedLeads) + (random() < expectedLeads % 1 ? 1 : 0);
  const conversions = leads > 0 && random() < 0.35 ? 1 : 0;
  return { date, impressions, clicks, spendCents, leads, conversions, conversionValueCents: conversions * AVERAGE_JOB_VALUE_CENTS };
}

export function demoAdAdapter(platform: ConnectionPlatform): AdAdapter {
  return {
    platform,
    async publish(request) {
      const short = request.attemptKey.replace(/[^a-z0-9]/gi, '').slice(0, 12);
      return {
        externalIds: { campaign: `demo_${platform}_campaign_${short}`, ad: `demo_${platform}_ad_${short}` },
        statusOnPlatform: 'SIMULATED_PAUSED',
        simulated: true,
        requestPreview: { note: 'Demo mode: nothing was sent.', platform, campaign: request.campaign, variants: request.variants },
      };
    },
    async setStatus() {
      // Simulated: the caller records SIMULATED_ACTIVE / SIMULATED_PAUSED.
    },
    async setBudget() {
      // Simulated: the caller stores the new daily budget.
    },
    async insights(externalIds, date, dailyBudgetCents) {
      return simulateDailyMetrics(externalIds.ad ?? externalIds.campaign ?? platform, date, dailyBudgetCents);
    },
  };
}

export function demoPostAdapter(platform: SocialPlatform): PostAdapter {
  return {
    platform,
    async publish(request) {
      return {
        externalId: `demo_${platform}_post_${request.postId.slice(0, 8)}`,
        permalink: null,
        status: 'simulated',
        simulated: true,
        requestPreview: { note: 'Demo mode: nothing was posted.', platform, caption: request.caption, imageUrl: request.imageUrl, linkUrl: request.linkUrl, options: request.options },
      };
    },
  };
}
