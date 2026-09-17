import 'server-only';
import { adminDb, type Db } from './db';

/** Monthly AI spend: the sum of logged generation costs since the 1st (UTC) against the owner's cap. */

export interface AiSpendStatus {
  spentUsd: number;
  capUsd: number;
  /** 0 cap pauses live AI entirely. */
  over: boolean;
  monthStart: string;
}

export const DEFAULT_AI_CAP_USD = 25;

export function monthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function isOverCap(spentUsd: number, capUsd: number): boolean {
  return capUsd <= 0 || spentUsd >= capUsd;
}

export async function monthlyAiSpend(db: Db = adminDb(), now = new Date()): Promise<AiSpendStatus> {
  const monthStart = monthStartIso(now);
  const [{ data: settings, error: settingsError }, { data: jobs, error: jobsError }] = await Promise.all([
    db.from('marketing_settings').select('ai_monthly_cap_usd').eq('id', 1).maybeSingle(),
    db.from('ai_generation_jobs').select('cost_usd').gte('created_at', monthStart).limit(20_000),
  ]);
  // Fail closed: if spend can't be read, treat the cap as reached.
  if (jobsError || settingsError) {
    console.error(`[marketing/ai] spend check failed: ${(jobsError ?? settingsError)?.message}`);
    return { spentUsd: 0, capUsd: 0, over: true, monthStart };
  }
  const capUsd = settings ? Number(settings.ai_monthly_cap_usd) : DEFAULT_AI_CAP_USD;
  const spentUsd = Math.round((jobs ?? []).reduce((t, j) => t + Number(j.cost_usd), 0) * 100_000) / 100_000;
  return { spentUsd, capUsd, over: isOverCap(spentUsd, capUsd), monthStart };
}
