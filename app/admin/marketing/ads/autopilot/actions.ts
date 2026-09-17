'use server';

import { revalidatePath } from 'next/cache';
import { type ActionState, checkbox, guard } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { decideApproval } from '@/lib/marketing/content/approvals-service';
import { adminDb } from '@/lib/marketing/content/db';
import { runWeeklyPlanner } from '@/lib/marketing/content/planner-service';

const CREATED_ID = /^(?:creative|post) ([0-9a-f-]{36})/i;

/** Drafts every item in this week's plan, then approves the drafts in one go. */
export async function approveWeek(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const acknowledged = checkbox(form, 'ack');
    const db = adminDb();
    const { results } = await runWeeklyPlanner({ execute: true, requestedBy: viewer.userId }, db);
    const ids = results.map((r) => CREATED_ID.exec(r.outcome)?.[1]).filter((id): id is string => Boolean(id));
    const skipped = results.filter((r) => r.outcome.startsWith('skipped')).length;

    const { data: pending } = ids.length
      ? await db.from('marketing_approvals').select('id').in('subject_id', ids).eq('decision', 'pending')
      : { data: [] };
    let approved = 0;
    let held = 0;
    for (const row of pending ?? []) {
      const result = await decideApproval({ approvalId: row.id, decision: 'approved', decidedBy: viewer.userId, acknowledgeWarnings: acknowledged }, db);
      if (result.ok) approved += 1;
      else held += 1;
    }

    revalidatePath('/admin/marketing/ads', 'layout');
    revalidatePath('/admin/marketing/social', 'layout');
    const parts = [`Drafted ${ids.length}, approved ${approved}.`];
    if (held) parts.push(`${held} need a look in Approvals.`);
    if (skipped) parts.push(`${skipped} skipped (not enough data).`);
    return { notice: parts.join(' ') };
  });
}
