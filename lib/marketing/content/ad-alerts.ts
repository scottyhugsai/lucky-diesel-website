/**
 * Spend, cost-per-lead and creative-fatigue checks over a campaign's daily
 * metrics. Pure: the metrics service stores and sends what this returns.
 */

export interface MetricDay {
  /** YYYY-MM-DD */
  date: string;
  spendCents: number;
  impressions: number;
  clicks: number;
  leads: number;
}

export type AdAlertKind = 'cpl_spike' | 'zero_leads' | 'fatigue';

export interface AdAlert {
  kind: AdAlertKind;
  message: string;
}

export const ALERT_RULES = {
  recentDays: 3,
  baselineDays: 14,
  /** Recent cost per lead this many times the baseline → alert. */
  cplSpikeRatio: 1.5,
  minBaselineLeads: 3,
  /** Spend with no leads over the recent window → alert. */
  zeroLeadSpendCents: 3000,
  fatigueWindowDays: 7,
  fatigueMinImpressions: 1000,
  /** Latest CTR below this share of the first week's CTR → fatigue. */
  fatigueCtrRatio: 0.7,
} as const;

const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;

function sum(rows: readonly MetricDay[]) {
  return rows.reduce((t, r) => ({ spendCents: t.spendCents + r.spendCents, impressions: t.impressions + r.impressions, clicks: t.clicks + r.clicks, leads: t.leads + r.leads }), { spendCents: 0, impressions: 0, clicks: 0, leads: 0 });
}

/** Days must be one row per date; order doesn't matter. */
export function evaluateAdAlerts(days: readonly MetricDay[], rules = ALERT_RULES): AdAlert[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const alerts: AdAlert[] = [];
  if (sorted.length < rules.recentDays) return alerts;

  const recent = sum(sorted.slice(-rules.recentDays));
  const baseline = sum(sorted.slice(-(rules.recentDays + rules.baselineDays), -rules.recentDays));

  if (recent.leads === 0 && recent.spendCents >= rules.zeroLeadSpendCents) {
    alerts.push({ kind: 'zero_leads', message: `${dollars(recent.spendCents)} spent in ${rules.recentDays} days with no leads` });
  } else if (recent.leads > 0 && baseline.leads >= rules.minBaselineLeads) {
    const recentCpl = recent.spendCents / recent.leads;
    const baseCpl = baseline.spendCents / baseline.leads;
    if (recentCpl > baseCpl * rules.cplSpikeRatio) {
      alerts.push({ kind: 'cpl_spike', message: `cost per lead ${dollars(recentCpl)}, up from ${dollars(baseCpl)}` });
    }
  }

  const fatigue = creativeFatigue(sorted, rules);
  if (fatigue) alerts.push(fatigue);
  return alerts;
}

/** First week's click-through rate vs the latest week. Needs two full, separate weeks. */
export function creativeFatigue(days: readonly MetricDay[], rules = ALERT_RULES): AdAlert | null {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < rules.fatigueWindowDays * 2) return null;
  const first = sum(sorted.slice(0, rules.fatigueWindowDays));
  const last = sum(sorted.slice(-rules.fatigueWindowDays));
  if (first.impressions < rules.fatigueMinImpressions || last.impressions < rules.fatigueMinImpressions || first.clicks === 0) return null;
  const firstCtr = first.clicks / first.impressions;
  const lastCtr = last.clicks / last.impressions;
  if (lastCtr >= firstCtr * rules.fatigueCtrRatio) return null;
  return { kind: 'fatigue', message: `click rate fell from ${(firstCtr * 100).toFixed(1)}% to ${(lastCtr * 100).toFixed(1)}%. Refresh the ad` };
}
