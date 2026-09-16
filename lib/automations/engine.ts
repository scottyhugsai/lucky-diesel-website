import 'server-only';
import type { Tables } from '@/lib/db/database.types';
import { sendMessage } from '@/lib/messaging/send';
import { renderTemplate } from '@/lib/messaging/template';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildRunContext, ownerRecipient, type Recipient } from './context';
import { applyQuietHours, computeScheduledFor, dedupeKey } from './schedule';

export type SubjectType = 'lead' | 'appointment' | 'work_order' | 'invoice' | 'customer' | 'shop';

export interface AutomationEvent {
  /** e.g. 'lead.created', 'work_order.status:ready' */
  name: string;
  subjectType: SubjectType;
  subjectId: string | null;
  /** Extra data stored on the run, e.g. { vehicle_id, due_service }. */
  context?: Record<string, string | number | boolean | null>;
  /** Makes repeated events distinct (e.g. a second service-due cycle). */
  discriminator?: string;
  occurredAt?: Date;
}

export interface DispatchSummary {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Schedules every enabled automation listening for this event, then sends
 * whatever is already due. Safe to call repeatedly: runs are deduplicated.
 */
export async function emit(event: AutomationEvent): Promise<{ scheduled: number }> {
  const db = createAdminClient();
  const occurredAt = event.occurredAt ?? new Date();

  const { data: automations, error } = await db
    .from('automations')
    .select('*')
    .eq('trigger_event', event.name)
    .eq('enabled', true);
  if (error) {
    console.error(`[automations] could not load automations for ${event.name}: ${error.message}`);
    return { scheduled: 0 };
  }
  if (!automations?.length) return { scheduled: 0 };

  let appointmentStartsAt: Date | null = null;
  if (event.subjectType === 'appointment' && event.subjectId) {
    const { data } = await db.from('appointments').select('starts_at').eq('id', event.subjectId).maybeSingle();
    appointmentStartsAt = data ? new Date(data.starts_at) : null;
  }

  const rows = automations.flatMap((automation) => {
    const at = computeScheduledFor({
      anchor: automation.anchor,
      delayMinutes: automation.delay_minutes,
      eventAt: occurredAt,
      appointmentStartsAt,
    });
    if (!at) return [];
    const isDelayedCustomerText = automation.audience === 'customer' && automation.channels.includes('sms') && at > occurredAt;
    const scheduledFor = isDelayedCustomerText ? applyQuietHours(at) : at;
    return [{
      automation_key: automation.key,
      subject_type: event.subjectType,
      subject_id: event.subjectId,
      audience: automation.audience,
      context: event.context ?? {},
      scheduled_for: scheduledFor.toISOString(),
      dedupe_key: dedupeKey(automation.key, event.subjectType, event.subjectId, event.discriminator),
    }];
  });

  if (rows.length) {
    const { error: insertError } = await db.from('automation_runs').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true });
    if (insertError) console.error(`[automations] could not schedule ${event.name}: ${insertError.message}`);
  }

  await dispatchDue();
  return { scheduled: rows.length };
}

/** Cancels pending runs for a subject, e.g. when an appointment is cancelled. */
export async function cancelScheduled(subjectType: SubjectType, subjectId: string, automationKeys?: string[]): Promise<void> {
  let query = createAdminClient()
    .from('automation_runs')
    .update({ status: 'cancelled', executed_at: new Date().toISOString(), detail: 'cancelled by an update' })
    .eq('subject_type', subjectType)
    .eq('subject_id', subjectId)
    .eq('status', 'scheduled');
  if (automationKeys?.length) query = query.in('automation_key', automationKeys);
  const { error } = await query;
  if (error) console.error(`[automations] cancel failed: ${error.message}`);
}

function recipientsFor(audience: string, customer: Recipient, tech: Recipient | null, owner: Recipient): Recipient[] {
  if (audience === 'owner') return [owner];
  if (audience === 'tech') return tech && (tech.phone || tech.email) ? [tech, owner] : [owner];
  return [customer];
}

async function executeRun(
  db: ReturnType<typeof createAdminClient>,
  run: Tables<'automation_runs'>,
  automation: Tables<'automations'>,
  owner: Recipient,
): Promise<{ status: 'sent' | 'skipped' | 'failed'; detail: string }> {
  if (!automation.enabled) return { status: 'skipped', detail: 'automation turned off' };

  const context = await buildRunContext(db, run);
  if (!context) return { status: 'skipped', detail: 'subject no longer exists' };
  if (context.skipReason) return { status: 'skipped', detail: context.skipReason };

  const outcomes: string[] = [];
  let anySent = false;
  let anyFailed = false;

  for (const recipient of recipientsFor(automation.audience, context.customer, context.tech, owner)) {
    for (const channel of automation.channels) {
      const to = channel === 'sms' ? recipient.phone : recipient.email;
      if (!to) {
        outcomes.push(`${channel}: no address`);
        continue;
      }
      const body = renderTemplate((channel === 'sms' ? automation.sms_template : automation.email_body_template) ?? '', context.vars);
      if (!body) {
        outcomes.push(`${channel}: empty template`);
        continue;
      }
      const result = await sendMessage({
        channel,
        to,
        subject: channel === 'email' ? renderTemplate(automation.email_subject_template ?? automation.name, context.vars) : undefined,
        body,
        customerId: recipient.customerId,
        workOrderId: context.workOrderId,
        automationKey: automation.key,
        requiresSmsConsent: recipient.isCustomer,
      });
      outcomes.push(`${channel}: ${result.status}${result.error ? ` (${result.error})` : ''}`);
      if (result.status === 'sent' || result.status === 'simulated') anySent = true;
      if (result.status === 'failed') anyFailed = true;
    }
  }

  const detail = outcomes.join(' · ') || 'no recipients';
  if (anySent) return { status: 'sent', detail };
  return { status: anyFailed ? 'failed' : 'skipped', detail };
}

/**
 * Sends every scheduled run due by `now`. `now` in the future is the demo
 * "fast-forward": it fires reminders early so they can be shown live.
 */
export async function dispatchDue({ now = new Date(), limit = 50 } = {}): Promise<DispatchSummary> {
  const db = createAdminClient();
  const summary: DispatchSummary = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  const { data: due, error } = await db
    .from('automation_runs')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for')
    .limit(limit);
  if (error) {
    console.error(`[automations] could not load due runs: ${error.message}`);
    return summary;
  }
  if (!due?.length) return summary;

  const [{ data: automations }, owner] = await Promise.all([
    db.from('automations').select('*').in('key', [...new Set(due.map((r) => r.automation_key))]),
    ownerRecipient(db),
  ]);
  const byKey = new Map((automations ?? []).map((a) => [a.key, a]));

  for (const run of due) {
    // Claim the run so a concurrent dispatcher can't send it twice.
    const { data: claimed } = await db
      .from('automation_runs')
      .update({ executed_at: new Date().toISOString() })
      .eq('id', run.id)
      .eq('status', 'scheduled')
      .is('executed_at', null)
      .select('id');
    if (!claimed?.length) continue;

    const automation = byKey.get(run.automation_key);
    const outcome = automation
      ? await executeRun(db, run, automation, owner).catch((caught: unknown) => ({
          status: 'failed' as const,
          detail: caught instanceof Error ? caught.message : String(caught),
        }))
      : { status: 'skipped' as const, detail: 'automation deleted' };

    await db.from('automation_runs').update({ status: outcome.status, detail: outcome.detail }).eq('id', run.id);
    summary.processed += 1;
    summary[outcome.status] += 1;
  }
  return summary;
}
