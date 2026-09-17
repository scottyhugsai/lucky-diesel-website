import 'server-only';
import { renderTemplate, type TemplateVars } from '@/lib/messaging/template';
import { sendMessage } from '@/lib/messaging/send';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import type { createAdminClient } from '@/lib/supabase/admin';

type Db = ReturnType<typeof createAdminClient>;

export interface CatalogRecipient { email: string | null; phone: string | null; customerId: string | null; isCustomer: boolean }

export interface CatalogSendInput {
  key: string;
  /** Subject recorded on the automation run (e.g. event_registration, stock_alert, fleet_account, shop). */
  subjectType: string;
  subjectId: string | null;
  /** Unique per logical message, e.g. `event_reminder:<reg>:7d`. */
  dedupeKey: string;
  recipient: CatalogRecipient;
  vars: TemplateVars;
}

export type CatalogSendOutcome = 'sent' | 'skipped' | 'failed' | 'duplicate' | 'disabled';

/**
 * Sends one message from an owner-editable catalog automation for subjects the
 * engine doesn't model (registrations, stock alerts, fleet accounts). The run is
 * claimed first through its unique dedupe key, so repeated sweeps never double-send;
 * consent, suppressions, caps and quiet hours still apply inside sendMessage.
 */
export async function sendCatalogMessage(db: Db, input: CatalogSendInput): Promise<CatalogSendOutcome> {
  const { data: automation } = await db.from('automations').select('*').eq('key', input.key).maybeSingle();
  if (!automation?.enabled) return 'disabled';

  const { data: claimed, error: claimError } = await db.from('automation_runs').upsert({
    automation_key: input.key, subject_type: input.subjectType, subject_id: input.subjectId, dedupe_key: input.dedupeKey,
    status: 'skipped', detail: 'sending', executed_at: new Date().toISOString(), scheduled_for: new Date().toISOString(),
  }, { onConflict: 'dedupe_key', ignoreDuplicates: true }).select('id');
  if (claimError) {
    console.error(`[community] could not claim ${input.dedupeKey}: ${claimError.message}`);
    return 'failed';
  }
  const runId = claimed?.[0]?.id;
  if (!runId) return 'duplicate';

  const base = siteUrl();
  const vars: TemplateVars = { shop_phone: BUSINESS.phoneDisplay, booking_link: `${base}/book`, admin_link: `${base}/admin`, ...input.vars };
  const outcomes: string[] = [];
  let anySent = false;
  let anyFailed = false;
  for (const channel of automation.channels) {
    const to = channel === 'sms' ? input.recipient.phone : input.recipient.email;
    const template = channel === 'sms' ? automation.sms_template : automation.email_body_template;
    if (!to || !template) {
      outcomes.push(`${channel}: ${to ? 'empty template' : 'no address'}`);
      continue;
    }
    const result = await sendMessage({
      channel, to, body: renderTemplate(template, vars), customerId: input.recipient.customerId, automationKey: automation.key,
      subject: channel === 'email' ? renderTemplate(automation.email_subject_template ?? automation.name, vars) : undefined,
      requiresSmsConsent: input.recipient.isCustomer,
    });
    outcomes.push(`${channel}: ${result.status}${result.error ? ` (${result.error})` : ''}`);
    if (result.status === 'sent' || result.status === 'simulated') anySent = true;
    if (result.status === 'failed') anyFailed = true;
  }
  const status = anySent ? 'sent' : anyFailed ? 'failed' : 'skipped';
  await db.from('automation_runs').update({ status, detail: outcomes.join(' · ') || 'no recipients' }).eq('id', runId);
  return status;
}
