'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { dollarsToCents, guard, InputError, number, oneOf, requiredText, requiredUuid, text, type ActionState } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { generateWeeklyDigest } from '@/lib/marketing/core/analytics-jobs';
import { BUDGET_CHANNELS, GOAL_METRICS } from '@/lib/marketing/core/analytics-reports';
import { feedTokenHash } from '@/lib/marketing/core/report-feed';
import { createAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/marketing/reports';
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CALL_SOURCES = ['google', 'facebook', 'instagram', 'tiktok', 'bing', 'youtube', 'referral', 'email', 'sms', 'direct', 'other'] as const;

function month(form: FormData): string {
  const value = requiredText(form, 'month', 'Month', 7);
  if (!MONTH_RE.test(value)) throw new InputError('Pick a valid month.');
  return `${value}-01`;
}

export async function saveGoal(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const metric = oneOf(form, 'metric', GOAL_METRICS.map((g) => g.value), 'metric');
    const dollars = GOAL_METRICS.find((g) => g.value === metric)!.money;
    const target = dollars
      ? dollarsToCents(form, 'target', { label: 'Target', max: 1_000_000 })
      : number(form, 'target', { min: 0, max: 100_000, integer: true, label: 'Target' });
    const db = createAdminClient();
    if (target === null || target === 0) {
      const { error } = await db.from('marketing_goals').delete().eq('month', month(form)).eq('metric', metric);
      if (error) return { error: 'Couldn’t clear the target.' };
      revalidatePath(PATH);
      return { notice: 'Cleared.' };
    }
    const { error } = await db.from('marketing_goals').upsert({ month: month(form), metric, target }, { onConflict: 'month,metric' });
    if (error) return { error: 'Couldn’t save the target.' };
    revalidatePath(PATH);
    return { notice: 'Saved.' };
  });
}

export async function saveBudget(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const channel = oneOf(form, 'channel', BUDGET_CHANNELS, 'channel');
    const budget = dollarsToCents(form, 'budget', { label: 'Budget', max: 1_000_000 }) ?? 0;
    const manual = dollarsToCents(form, 'manual', { label: 'Logged spend', max: 1_000_000 }) ?? 0;
    const { error } = await createAdminClient().from('marketing_budgets')
      .upsert({ month: month(form), channel, budget_cents: budget, manual_spend_cents: manual }, { onConflict: 'month,channel' });
    if (error) return { error: 'Couldn’t save the budget.' };
    revalidatePath(PATH);
    return { notice: 'Saved.' };
  });
}

export async function acknowledgeAnomaly(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'alert_id', 'Alert');
    const { error } = await createAdminClient().from('marketing_anomalies').update({ acknowledged_at: new Date().toISOString() }).eq('id', id);
    if (error) return { error: 'Couldn’t clear the alert.' };
    revalidatePath(PATH);
    revalidatePath('/admin/marketing');
    return { notice: 'Cleared.' };
  });
}

export async function runDigestNow(): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const run = await generateWeeklyDigest(createAdminClient(), new Date(), { force: true });
    revalidatePath(PATH);
    return { notice: run.status === 'exists' ? 'Already written for that week.' : `Digest ready for week of ${run.weekStart}.` };
  });
}

export async function saveTrackingNumber(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const raw = requiredText(form, 'phone', 'Number', 30).replace(/\D/g, '');
    const national = raw.length === 11 && raw.startsWith('1') ? raw.slice(1) : raw;
    if (national.length !== 10) return { error: 'Enter a 10-digit number.' };
    const source = oneOf(form, 'source', CALL_SOURCES, 'source');
    const { error } = await createAdminClient().from('marketing_tracking_numbers')
      .upsert({ phone: `+1${national}`, source, label: text(form, 'label', { max: 60, label: 'Label' }) ?? '' }, { onConflict: 'phone' });
    if (error) return { error: 'Couldn’t save the number.' };
    revalidatePath(PATH);
    return { notice: 'Saved.' };
  });
}

export async function deleteTrackingNumber(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'number_id', 'Number');
    const { error } = await createAdminClient().from('marketing_tracking_numbers').delete().eq('id', id);
    if (error) return { error: 'Couldn’t remove the number.' };
    revalidatePath(PATH);
    return { notice: 'Removed.' };
  });
}

export async function createReportFeed(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const token = randomBytes(24).toString('base64url');
    const { error } = await createAdminClient().from('marketing_report_feeds')
      .insert({ label: text(form, 'label', { max: 60, label: 'Label' }) ?? 'Looker Studio', token_hash: feedTokenHash(token), created_by: viewer.profile.id });
    if (error) return { error: 'Couldn’t create the feed link.' };
    revalidatePath(PATH);
    return { notice: `Feed URL (copy now, shown once): /api/marketing/report-feed?token=${token}` };
  });
}

export async function revokeReportFeed(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredUuid(form, 'feed_id', 'Feed');
    const { error } = await createAdminClient().from('marketing_report_feeds').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    if (error) return { error: 'Couldn’t revoke the feed.' };
    revalidatePath(PATH);
    return { notice: 'Revoked.' };
  });
}
