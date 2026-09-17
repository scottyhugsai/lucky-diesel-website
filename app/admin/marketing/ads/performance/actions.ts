'use server';

import { revalidatePath } from 'next/cache';
import { type ActionState, guard } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { syncAdMetrics } from '@/lib/marketing/content/metrics-service';

/** Pulls yesterday's numbers for live campaigns and applies auto-pause rules. */
export async function syncNow(): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const summary = await syncAdMetrics();
    revalidatePath('/admin/marketing/ads/performance');
    revalidatePath('/admin/marketing/ads/campaigns');
    const paused = summary.paused.length ? ` Auto-paused ${summary.paused.length}.` : '';
    const errors = summary.errors.length ? ` ${summary.errors.length} failed: ${summary.errors[0]}` : '';
    return { notice: `Synced ${summary.campaigns} live campaigns (${summary.rows} rows${summary.simulatedRows ? ', simulated' : ''}).${paused}${errors}` };
  });
}
