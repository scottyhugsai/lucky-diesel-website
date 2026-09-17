import 'server-only';
import { dispatchDue } from '@/lib/automations/engine';
import { recordCronRun, runIntegrationHealth } from '@/lib/marketing/content/health-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { runAnalyticsJobs } from './analytics-jobs';
import { syncConversions } from './attribution';
import { draftMonthlyNewsletter, runEngagementSunset } from './autopilot';
import { runLocalTriggers } from './local-triggers';
import { runStockAlerts } from '@/lib/store/stock-alerts';
import { dispatchCampaignSends, type CampaignDispatchSummary } from './campaign-dispatch';
import { enrollSegmentDrips, materializeDueBroadcasts } from './campaigns';
import { runCrmSweep } from './crm-sweep';
import { runPartialFollowUps } from '@/lib/marketing/engage/partial';
import { ensureCatalogAutomations, runLifecycleSweep } from './lifecycle';
import { sweepOfferExpiry, syncLoyalty, syncScoresAndStages } from './loyalty';
import { processReferralRewards, sweepReferralAsks } from './referrals';
import { refreshAllSegments } from './segments';

export interface MarketingCronReport {
  steps: Record<string, unknown>;
  errors: string[];
}

/**
 * The marketing cron: sync derived data, refresh segments, enroll drips,
 * expand broadcasts, run the lifecycle sweep, then send what's due.
 * Every step is isolated so one failure doesn't stop the rest.
 *
 * Vercel Hobby runs crons once a day: schedule it inside the 9am–8pm ET
 * marketing window (e.g. `0 15 * * *`). On Pro, every 15 minutes keeps
 * broadcasts and drips on time.
 */
export async function runMarketingCron(now = new Date()): Promise<MarketingCronReport> {
  const db = createAdminClient();
  const report: MarketingCronReport = { steps: {}, errors: [] };
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      report.steps[name] = await fn();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      console.error(`[marketing cron] ${name} failed: ${message}`);
      report.errors.push(`${name}: ${message}`);
    }
  };

  await step('catalog', () => ensureCatalogAutomations(db));
  await step('conversions', () => syncConversions(db, now));
  await step('loyalty', () => syncLoyalty(db));
  await step('scores', () => syncScoresAndStages(db, now));
  await step('referrals', () => processReferralRewards(now, db));
  await step('segments', () => refreshAllSegments(db, now));
  await step('dripEnrollments', () => enrollSegmentDrips(now, db));
  await step('broadcasts', () => materializeDueBroadcasts(now, db));
  await step('lifecycle', () => runLifecycleSweep(now, db));
  await step('newsletter', () => draftMonthlyNewsletter(now, db));
  await step('sunset', () => runEngagementSunset(now, db));
  await step('crmSweep', () => runCrmSweep(db, now));
  await step('offerExpiry', () => sweepOfferExpiry(now, db));
  await step('referralAsks', () => sweepReferralAsks(now, db));
  await step('abandonedQuotes', () => runPartialFollowUps(now, db));
  await step('campaignSends', async (): Promise<CampaignDispatchSummary> => dispatchCampaignSends(now, 500, db));
  await step('automationRuns', () => dispatchDue({ now, limit: 200 }));
  await step('localTriggers', () => runLocalTriggers(db, now));
  await step('stockAlerts', () => runStockAlerts(db));
  await step('analytics', () => runAnalyticsJobs(db, now));
  await step('integrationHealth', () => runIntegrationHealth(db, now));
  await recordCronRun('marketing', now, report.errors.length === 0, report.errors, db);
  return report;
}
