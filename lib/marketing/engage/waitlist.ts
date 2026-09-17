import 'server-only';
import type { Db } from '@/lib/marketing/core/settings';
import { sendMessage } from '@/lib/messaging/send';
import { createAdminClient } from '@/lib/supabase/admin';
import { WAITLIST_TOPIC } from './rules';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_NOTIFY = 500;

export interface WaitlistInput { topic: string; label: string; email: string; name: string | null }

export function parseWaitlist(body: unknown): { ok: true; value: WaitlistInput } | { ok: false; spam?: boolean; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request.' };
  const v = body as Record<string, unknown>;
  const str = (key: string, max: number) => (typeof v[key] === 'string' ? (v[key] as string).trim().slice(0, max) : '');
  if (str('company', 100)) return { ok: false, spam: true, error: 'spam' };
  const topic = str('topic', 120);
  const label = str('label', 120);
  const email = str('email', 254).toLowerCase();
  if (!WAITLIST_TOPIC.test(topic) || !label) return { ok: false, error: 'Invalid list.' };
  if (!EMAIL.test(email)) return { ok: false, error: 'Enter a valid email.' };
  return { ok: true, value: { topic, label, email, name: str('name', 80) || null } };
}

/** Idempotent: signing up twice for the same topic keeps one row. */
export async function joinWaitlist(input: WaitlistInput, db: Db = createAdminClient()): Promise<boolean> {
  const { data: customer } = await db.from('customers').select('id').eq('email', input.email).limit(1).maybeSingle();
  const { error } = await db.from('waitlist_signups').upsert(
    { topic: input.topic, topic_label: input.label, email: input.email, full_name: input.name, customer_id: customer?.id ?? null },
    { onConflict: 'topic,email', ignoreDuplicates: true },
  );
  if (error) console.error(`[engage] waitlist join failed: ${error.message}`);
  return !error;
}

/** Owner-triggered: emails everyone waiting on a topic once, then marks them notified. It's the notice they asked for. */
export async function notifyWaitlist(topic: string, message: string, db: Db = createAdminClient()): Promise<{ sent: number; failed: number }> {
  const { data: rows } = await db.from('waitlist_signups').select('id, email, customer_id, topic_label').eq('topic', topic).is('notified_at', null).limit(MAX_NOTIFY);
  let sent = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    const result = await sendMessage({
      channel: 'email', to: row.email, customerId: row.customer_id, automationKey: 'waitlist_notice', purpose: 'transactional',
      subject: `${row.topic_label}: update from Lucky Diesel`,
      body: `${message}\n\nYou asked us to let you know about ${row.topic_label}. This is the only email for this list.\n\n— Lucky Diesel`,
    });
    if (result.status === 'failed') {
      failed++;
      continue;
    }
    sent++;
    await db.from('waitlist_signups').update({ notified_at: new Date().toISOString() }).eq('id', row.id);
  }
  return { sent, failed };
}
