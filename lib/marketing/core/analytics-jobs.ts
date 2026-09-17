import 'server-only';
import { ownerContact, sendContentMessage } from '@/lib/marketing/content/alerts';
import { createAdminClient } from '@/lib/supabase/admin';
import { siteUrl } from '@/lib/site-url';
import { getDailyStats, getMarketingFunnel } from './analytics';
import { dayKey, startOfDayInZone } from './analytics-math';
import { buildDigest, detectAnomalies, sumDays, weekStartOf, type Digest } from './analytics-reports';
import { sourceLabel } from '@/components/admin/marketing/core-ui/labels';
import type { Db } from './settings';

const DAY_MS = 86_400_000;
export const DIGEST_KEY = 'content_weekly_digest';
export const ANOMALY_KEY = 'content_anomaly_alert';

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

function shopWeekday(now: Date): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/New_York' }).format(now);
}

export interface AnomalyRun {
  found: number;
  alerted: number;
}

/** Daily: compares the last 7 complete days with the 4 weeks before and alerts the owner once per new anomaly. */
export async function checkAnomalies(db: Db = createAdminClient(), now = new Date()): Promise<AnomalyRun> {
  const today = dayKey(now);
  const end = startOfDayInZone(today);
  const days = (await getDailyStats(db, new Date(end.getTime() - 35 * DAY_MS), new Date(end.getTime() - 1))).filter((d) => d.date < today).slice(-35);
  const found = detectAnomalies(days);
  let alerted = 0;
  for (const anomaly of found) {
    const { data, error } = await db.from('marketing_anomalies').upsert({
      metric: anomaly.metric, direction: anomaly.direction, current_value: anomaly.current, baseline_value: anomaly.baseline,
      change_ratio: anomaly.changeRatio, message: anomaly.message, dedupe_key: anomaly.dedupeKey,
    }, { onConflict: 'dedupe_key', ignoreDuplicates: true }).select('id');
    if (error) throw new Error(`anomaly insert failed: ${error.message}`);
    const id = data?.[0]?.id;
    if (!id) continue;
    const outcome = await sendContentMessage(db, ANOMALY_KEY, await ownerContact(db), { alert: anomaly.message, admin_link: `${siteUrl()}/admin/marketing/reports#alerts` });
    if (outcome.sent > 0) {
      alerted += 1;
      await db.from('marketing_anomalies').update({ alerted: true }).eq('id', id);
    }
  }
  return { found: found.length, alerted };
}

export interface DigestRun {
  status: 'created' | 'exists' | 'not_monday';
  weekStart: string;
  digest?: Digest;
  sent?: number;
}

/** Monday digest for the previous Mon–Sun week. Stored in-app, emailed to the owner (demo inbox until Resend). `force` skips the Monday check. */
export async function generateWeeklyDigest(db: Db = createAdminClient(), now = new Date(), { force = false } = {}): Promise<DigestRun> {
  const today = dayKey(now);
  const weekStart = addDays(weekStartOf(today), -7);
  if (!force && shopWeekday(now) !== 'Mon') return { status: 'not_monday', weekStart };
  const { data: existing } = await db.from('marketing_digests').select('id').eq('week_start', weekStart).maybeSingle();
  if (existing) return { status: 'exists', weekStart };

  const from = startOfDayInZone(addDays(weekStart, -7));
  const weekFrom = startOfDayInZone(weekStart);
  const to = new Date(startOfDayInZone(addDays(weekStart, 7)).getTime() - 1);
  const [days, funnel, { count: openAlerts }] = await Promise.all([
    getDailyStats(db, from, to),
    getMarketingFunnel({ from: weekFrom, to, model: 'last' }, db),
    db.from('marketing_anomalies').select('id', { count: 'exact', head: true }).is('acknowledged_at', null),
  ]);
  const current = sumDays(days.filter((d) => d.date >= weekStart));
  const previous = sumDays(days.filter((d) => d.date < weekStart));
  const top = funnel.rows.find((r) => r.revenueCents > 0 || r.leads > 0);
  const digest = buildDigest({ weekStart, current, previous, topSource: top ? sourceLabel(top.source) : null, openAlerts: openAlerts ?? 0, goalLine: null });

  const { data: inserted, error } = await db.from('marketing_digests')
    .upsert({ week_start: weekStart, summary: { current: { ...current }, previous: { ...previous }, topSource: top?.source ?? null }, body: digest.text }, { onConflict: 'week_start', ignoreDuplicates: true })
    .select('id');
  if (error) throw new Error(`digest insert failed: ${error.message}`);
  const id = inserted?.[0]?.id;
  if (!id) return { status: 'exists', weekStart };

  const outcome = await sendContentMessage(db, DIGEST_KEY, await ownerContact(db), {
    headline: digest.headline, digest_text: digest.text, admin_link: `${siteUrl()}/admin/marketing/reports#digest`,
  });
  await db.from('marketing_digests').update({ sent_count: outcome.sent, send_detail: outcome.skipped.join('; ').slice(0, 500) || null }).eq('id', id);
  return { status: 'created', weekStart, digest, sent: outcome.sent };
}

/** Cron step: anomaly check every run, digest on Mondays. Each part isolated. */
export async function runAnalyticsJobs(db: Db = createAdminClient(), now = new Date()): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  try {
    result.anomalies = await checkAnomalies(db, now);
  } catch (error) {
    result.anomaliesError = error instanceof Error ? error.message : String(error);
  }
  try {
    const run = await generateWeeklyDigest(db, now);
    result.digest = { status: run.status, weekStart: run.weekStart, sent: run.sent };
  } catch (error) {
    result.digestError = error instanceof Error ? error.message : String(error);
  }
  if (result.anomaliesError || result.digestError) throw new Error(`analytics: ${String(result.anomaliesError ?? '')} ${String(result.digestError ?? '')}`.trim());
  return result;
}
