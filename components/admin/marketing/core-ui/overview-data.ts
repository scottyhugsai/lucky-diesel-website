import 'server-only';
import { summarizeLast30Days } from '@/lib/marketing/content/assistant';
import { getCompliancePulse, getMarketingFunnel, type AttributionModel, type FunnelReport } from '@/lib/marketing/core/analytics';
import { createAdminClient } from '@/lib/supabase/admin';

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 90;

export interface NeedsYou {
  approvals: number;
  reviews: number;
  scheduled: number;
  drafts: number;
}

export interface CompliancePanel {
  optOuts30d: number;
  suppressed: number;
  smsConsented: number;
  emailSubscribed: number;
  capsHit: number;
  quietDeferrals: number;
}

export interface Overview {
  funnel: FunnelReport | null;
  funnelError: string | null;
  visitors: number;
  needs: NeedsYou;
  compliance: CompliancePanel;
  summary: { text: string; simulated: boolean } | null;
}

async function countOf(query: PromiseLike<{ count: number | null }>): Promise<number> {
  const { count } = await query;
  return count ?? 0;
}

export async function loadOverview(model: AttributionModel, now = new Date()): Promise<Overview> {
  const db = createAdminClient();
  const from = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const since30 = new Date(now.getTime() - 30 * DAY_MS).toISOString();

  const funnelPromise = getMarketingFunnel({ from, to: now, model }, db).then(
    (funnel) => ({ funnel, error: null }),
    (caught: unknown) => ({ funnel: null, error: caught instanceof Error ? caught.message : 'Funnel unavailable' }),
  );
  const summaryPromise = summarizeLast30Days(db).then(
    (answer) => ({ text: answer.text, simulated: answer.includesSimulatedData }),
    () => null,
  );

  const [funnelResult, summary, pulse, visitors, approvals, reviews, scheduled, drafts, capMsgs, capSends, quietMsgs, quietSends] = await Promise.all([
    funnelPromise,
    summaryPromise,
    getCompliancePulse(db, now),
    countOf(db.from('tracking_visitors').select('anonymous_id', { count: 'exact', head: true }).gte('first_seen_at', from.toISOString())),
    countOf(db.from('marketing_approvals').select('id', { count: 'exact', head: true }).eq('decision', 'pending')),
    countOf(db.from('reviews').select('id', { count: 'exact', head: true }).eq('replied', false).neq('source', 'internal')),
    countOf(db.from('campaigns').select('id', { count: 'exact', head: true }).in('status', ['scheduled', 'sending'])),
    countOf(db.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'draft')),
    countOf(db.from('messages').select('id', { count: 'exact', head: true }).eq('status', 'skipped').ilike('error', 'frequency cap%').gte('created_at', since30)),
    countOf(db.from('campaign_sends').select('id', { count: 'exact', head: true }).ilike('detail', 'frequency cap%').gte('created_at', since30)),
    countOf(db.from('messages').select('id', { count: 'exact', head: true }).eq('status', 'skipped').ilike('error', 'quiet hours%').gte('created_at', since30)),
    countOf(db.from('campaign_sends').select('id', { count: 'exact', head: true }).ilike('detail', 'quiet hours%').gte('created_at', since30)),
  ]);

  return {
    funnel: funnelResult.funnel,
    funnelError: funnelResult.error,
    visitors,
    needs: { approvals, reviews, scheduled, drafts },
    compliance: {
      optOuts30d: pulse.optOuts30d, suppressed: pulse.suppressed, smsConsented: pulse.smsMarketingConsented, emailSubscribed: pulse.emailSubscribed,
      capsHit: capMsgs + capSends, quietDeferrals: quietMsgs + quietSends,
    },
    summary,
  };
}
