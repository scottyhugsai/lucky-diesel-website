/** Win/loss reporting and a small predictive win score. Pure. */

export interface OutcomeLead {
  status: string;
  source: string;
  serviceId: string | null;
  platform: string | null;
  lostReason: string | null;
  stageName: string | null;
  dealValueCents: number;
  createdAt: Date;
  contactedAt: Date | null;
}

export interface RateRow {
  label: string;
  won: number;
  lost: number;
  open: number;
  winRate: number | null;
  wonValueCents: number;
}

function rows(leads: readonly OutcomeLead[], keyOf: (lead: OutcomeLead) => string): RateRow[] {
  const map = new Map<string, RateRow>();
  for (const lead of leads) {
    const label = keyOf(lead);
    const row = map.get(label) ?? { label, won: 0, lost: 0, open: 0, winRate: null, wonValueCents: 0 };
    const next = lead.status === 'won'
      ? { ...row, won: row.won + 1, wonValueCents: row.wonValueCents + lead.dealValueCents }
      : lead.status === 'lost' ? { ...row, lost: row.lost + 1 } : { ...row, open: row.open + 1 };
    map.set(label, next);
  }
  return [...map.values()]
    .map((r) => ({ ...r, winRate: r.won + r.lost ? r.won / (r.won + r.lost) : null }))
    .sort((a, b) => b.won + b.lost + b.open - (a.won + a.lost + a.open));
}

export interface WinLossReport {
  total: number;
  won: number;
  lost: number;
  winRate: number | null;
  wonValueCents: number;
  openValueCents: number;
  medianFirstResponseMinutes: number | null;
  bySource: RateRow[];
  byService: RateRow[];
  byStage: { label: string; count: number }[];
  lostReasons: { label: string; count: number }[];
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export function winLossReport(leads: readonly OutcomeLead[], labels: { service: (id: string | null) => string; source: (s: string) => string }): WinLossReport {
  const won = leads.filter((l) => l.status === 'won');
  const lost = leads.filter((l) => l.status === 'lost');
  const counts = (values: string[]) => [...values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>())].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  return {
    total: leads.length,
    won: won.length,
    lost: lost.length,
    winRate: won.length + lost.length ? won.length / (won.length + lost.length) : null,
    wonValueCents: won.reduce((s, l) => s + l.dealValueCents, 0),
    openValueCents: leads.filter((l) => l.status !== 'won' && l.status !== 'lost').reduce((s, l) => s + l.dealValueCents, 0),
    medianFirstResponseMinutes: median(leads.filter((l) => l.contactedAt).map((l) => Math.max(0, Math.round((l.contactedAt!.getTime() - l.createdAt.getTime()) / 60_000)))),
    bySource: rows(leads, (l) => labels.source(l.source)),
    byService: rows(leads, (l) => labels.service(l.serviceId)),
    byStage: counts(leads.map((l) => l.stageName ?? 'Unstaged')),
    lostReasons: counts(lost.map((l) => l.lostReason ?? 'No reason')),
  };
}

// ─── Predictive win score ───────────────────────────────────────────────────
/** Below this many decided leads the score is hidden: too little data to mean anything. */
export const MIN_OUTCOMES = 30;

type Feature = 'source' | 'service' | 'platform';
const FEATURES: readonly Feature[] = ['source', 'service', 'platform'];

export interface WinModel {
  outcomes: number;
  prior: number;
  counts: Record<Feature, Record<string, { won: number; lost: number }>>;
}

function featureValue(lead: Pick<OutcomeLead, 'source' | 'serviceId' | 'platform'>, feature: Feature): string {
  const raw = feature === 'source' ? lead.source : feature === 'service' ? lead.serviceId : lead.platform;
  return (raw ?? 'unknown').toLowerCase();
}

/** Naive Bayes over source, service and platform with add-one smoothing. Null until MIN_OUTCOMES. */
export function trainWinModel(leads: readonly OutcomeLead[]): WinModel | null {
  const decided = leads.filter((l) => l.status === 'won' || l.status === 'lost');
  if (decided.length < MIN_OUTCOMES) return null;
  const counts = { source: {}, service: {}, platform: {} } as WinModel['counts'];
  for (const lead of decided) {
    for (const feature of FEATURES) {
      const value = featureValue(lead, feature);
      const current = counts[feature][value] ?? { won: 0, lost: 0 };
      counts[feature][value] = lead.status === 'won' ? { ...current, won: current.won + 1 } : { ...current, lost: current.lost + 1 };
    }
  }
  const wins = decided.filter((l) => l.status === 'won').length;
  return { outcomes: decided.length, prior: wins / decided.length, counts };
}

/** 0–100 chance of winning, or null without a model. */
export function predictWin(model: WinModel | null, lead: Pick<OutcomeLead, 'source' | 'serviceId' | 'platform'>): number | null {
  if (!model) return null;
  const wins = Math.max(1, Math.round(model.prior * model.outcomes));
  const losses = Math.max(1, model.outcomes - wins);
  let logOdds = Math.log(wins / losses);
  for (const feature of FEATURES) {
    const values = Object.keys(model.counts[feature]).length + 1;
    const c = model.counts[feature][featureValue(lead, feature)] ?? { won: 0, lost: 0 };
    logOdds += Math.log((c.won + 1) / (wins + values)) - Math.log((c.lost + 1) / (losses + values));
  }
  return Math.round(100 / (1 + Math.exp(-logOdds)));
}
