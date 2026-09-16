import 'server-only';
import { vehicleLabel } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { RunCounts } from './AutomationFlowCard';
import type { DemoCustomer } from './DemoTools';

type Supabase = Awaited<ReturnType<typeof createClient>>;

const WEEK_MS = 7 * 86_400_000;
const RUN_SAMPLE = 5000;

export interface AutomationStats {
  emailsSent: number;
  textsSent: number;
  scheduled: number;
  skipped: number;
  topSkipReasons: { reason: string; count: number }[];
  automatedMessages: number;
}

/** Strips channel prefixes so "sms: skipped (no SMS consent on file)" and "no SMS consent on file" group together. */
export function skipReason(detail: string | null): string {
  if (!detail) return 'no reason recorded';
  const inner = detail.match(/\(([^)]+)\)/)?.[1];
  return (inner ?? detail.replace(/^(sms|email):\s*/i, '')).slice(0, 80);
}

export async function loadAutomationOverview(supabase: Supabase, now: Date) {
  const weekAgo = new Date(now.getTime() - WEEK_MS).toISOString();
  const [automations, runs, messages, customers] = await Promise.all([
    supabase.from('automations').select('*').order('sort').order('key'),
    supabase.from('automation_runs').select('automation_key, status, detail, created_at').order('created_at', { ascending: false }).limit(RUN_SAMPLE),
    supabase.from('messages').select('channel, status').not('automation_key', 'is', null).gte('created_at', weekAgo).in('status', ['sent', 'simulated']),
    supabase.from('customers').select('id, full_name, vehicles(id, year, make, model, engine_code, nickname)').order('full_name').limit(100),
  ]);

  const counts = new Map<string, RunCounts>();
  const reasons = new Map<string, number>();
  let scheduled = 0;
  let skipped = 0;
  for (const run of runs.data ?? []) {
    const entry = counts.get(run.automation_key) ?? { sent: 0, scheduled: 0, skipped: 0, failed: 0 };
    if (run.status !== 'cancelled') entry[run.status] += 1;
    counts.set(run.automation_key, entry);
    if (run.status === 'scheduled') scheduled += 1;
    if (run.status === 'skipped' && run.created_at >= weekAgo) {
      skipped += 1;
      const reason = skipReason(run.detail);
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
  }

  const sentMessages = messages.data ?? [];
  const stats: AutomationStats = {
    emailsSent: sentMessages.filter((m) => m.channel === 'email').length,
    textsSent: sentMessages.filter((m) => m.channel === 'sms').length,
    scheduled,
    skipped,
    topSkipReasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([reason, count]) => ({ reason, count })),
    automatedMessages: sentMessages.length,
  };

  const demoCustomers: DemoCustomer[] = (customers.data ?? []).map((c) => ({
    id: c.id,
    name: c.full_name,
    vehicles: (c.vehicles ?? []).map((v) => ({ id: v.id, label: v.nickname ? `${vehicleLabel(v)} “${v.nickname}”` : vehicleLabel(v) })),
  }));
  demoCustomers.sort((a, b) => Number(b.vehicles.length > 0) - Number(a.vehicles.length > 0));

  return {
    automations: automations.data ?? [],
    counts,
    stats,
    demoCustomers,
    error: automations.error?.message ?? runs.error?.message ?? null,
  };
}
