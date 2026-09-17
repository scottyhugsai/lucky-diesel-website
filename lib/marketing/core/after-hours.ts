import 'server-only';
import { sendMessage } from '@/lib/messaging/send';
import { getCrmSettings, getShopHours } from './crm-data';
import { claimAlert } from './crm-sweep';
import type { Db } from './settings';
import { autoReplyBucket, isShopOpen } from './speed';

export const AFTER_HOURS_KEY = 'after_hours_auto_reply';

/**
 * Business-hours auto-responder for a customer's inbound text (not STOP/START/HELP).
 * Outside shop hours, replies once per number per 12 hours. A reply to someone who
 * just texted us is conversational; STOP suppressions still apply in sendMessage.
 */
export async function autoReplyIfClosed(db: Db, input: { from: string; customerId: string | null; now?: Date }): Promise<{ replied: boolean; reason: string }> {
  const now = input.now ?? new Date();
  const [settings, hours] = await Promise.all([getCrmSettings(db), getShopHours(db)]);
  if (!settings.autoReplyEnabled) return { replied: false, reason: 'auto-reply off' };
  if (isShopOpen(now, hours)) return { replied: false, reason: 'shop open' };
  if (!(await claimAlert(db, 'after_hours_reply', autoReplyBucket(input.from, now)))) return { replied: false, reason: 'already replied recently' };
  const result = await sendMessage({ channel: 'sms', to: input.from, body: settings.autoReplyText, customerId: input.customerId, automationKey: AFTER_HOURS_KEY, purpose: 'transactional' });
  return { replied: result.status === 'sent' || result.status === 'simulated', reason: result.error ?? result.status };
}
