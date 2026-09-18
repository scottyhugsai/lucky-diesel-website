import 'server-only';
import { AUTOMATIONS } from '@/lib/automations/catalog';
import { ownerRecipients } from '@/lib/automations/owner-contacts';
import type { AlertRecipient } from '@/lib/automations/owner-select';
import type { Enums } from '@/lib/db/database.types';
import { sendMessage } from '@/lib/messaging/send';
import { renderTemplate, type TemplateVars } from '@/lib/messaging/template';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import type { Db } from './db';

/**
 * Sends one of this module's catalog messages (content_* keys) with our own
 * template variables. Wording and on/off come from the `automations` row the
 * owner edits; the catalog definition is the fallback.
 */

export type ContentRecipient = AlertRecipient;

/** Everyone who gets owner alerts. */
export async function ownerContacts(db: Db): Promise<ContentRecipient[]> {
  return ownerRecipients(db);
}

/** The first owner recipient, for callers that address exactly one person. */
export async function ownerContact(db: Db): Promise<ContentRecipient> {
  const [first] = await ownerContacts(db);
  return first!;
}

export interface SendOutcome {
  sent: number;
  skipped: string[];
}

export async function sendContentMessage(db: Db, key: string, recipient: ContentRecipient, vars: TemplateVars): Promise<SendOutcome> {
  const { data: row } = await db.from('automations').select('*').eq('key', key).maybeSingle();
  const fallback = AUTOMATIONS.find((a) => a.key === key);
  if (!row && !fallback) return { sent: 0, skipped: [`unknown message ${key}`] };
  if (row && !row.enabled) return { sent: 0, skipped: ['turned off by the owner'] };

  const channels: Enums<'message_channel'>[] = row?.channels ?? fallback?.channels ?? [];
  const templates = {
    sms: row?.sms_template ?? fallback?.sms ?? null,
    subject: row?.email_subject_template ?? fallback?.emailSubject ?? row?.name ?? fallback?.name ?? 'Lucky Diesel',
    email: row?.email_body_template ?? fallback?.emailBody ?? null,
  };
  const allVars: TemplateVars = { shop_phone: BUSINESS.phoneDisplay, booking_link: `${siteUrl()}/book`, admin_link: `${siteUrl()}/admin`, ...vars };
  const outcome: SendOutcome = { sent: 0, skipped: [] };

  for (const channel of channels) {
    const to = channel === 'sms' ? recipient.phone : recipient.email;
    const template = channel === 'sms' ? templates.sms : templates.email;
    if (!to || !template) {
      outcome.skipped.push(`${channel}: no ${to ? 'template' : 'address'}`);
      continue;
    }
    const result = await sendMessage({
      channel, to, body: renderTemplate(template, allVars), subject: channel === 'email' ? renderTemplate(templates.subject, allVars) : undefined,
      customerId: recipient.customerId, automationKey: key, requiresSmsConsent: recipient.isCustomer,
    });
    if (result.status === 'sent' || result.status === 'simulated') outcome.sent += 1;
    else outcome.skipped.push(`${channel}: ${result.status}${result.error ? ` (${result.error})` : ''}`);
  }
  return outcome;
}

/** Same message to every owner recipient. One failure never stops the others. */
export async function sendContentMessageToOwners(db: Db, key: string, vars: TemplateVars, owners?: ContentRecipient[]): Promise<SendOutcome> {
  const total: SendOutcome = { sent: 0, skipped: [] };
  for (const owner of owners ?? (await ownerContacts(db))) {
    const who = owner.label ? `${owner.label} ` : '';
    const one = await sendContentMessage(db, key, owner, vars).catch((caught: unknown) => ({
      sent: 0,
      skipped: [caught instanceof Error ? caught.message : String(caught)],
    }));
    total.sent += one.sent;
    total.skipped.push(...one.skipped.map((reason) => `${who}${reason}`));
  }
  return total;
}
