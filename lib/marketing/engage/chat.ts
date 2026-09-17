import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { ownerRecipient } from '@/lib/automations/context';
import { findOrCreateCustomer } from '@/lib/domain/leads';
import type { Db } from '@/lib/marketing/core/settings';
import { sendMessage } from '@/lib/messaging/send';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { CHAT_HOURS, afterHoursPrompt, cleanChatBody, isShopOpen } from './rules';

export const CHAT_COOKIE = 'ld_chat';
export const CHAT_COOKIE_MAX_AGE = 30 * 86_400;
const TIME_ZONE = 'America/New_York';
const TOKEN = /^[A-Za-z0-9_-]{40,64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_AUTO_PROMPTS = 3;
const MAX_MESSAGES_RETURNED = 200;

export interface ChatMessageView { id: string; sender: 'visitor' | 'shop' | 'auto'; body: string; at: string }
export interface ChatThreadView { name: string; status: 'open' | 'closed'; messages: ChatMessageView[] }

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function phone10(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return local.length === 10 ? `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}` : null;
}

export interface StartInput { name: string; email: string | null; phone: string | null; smsConsent: boolean; message: string; pageUrl: string | null }

export function parseStart(body: Record<string, unknown>): { ok: true; value: StartInput } | { ok: false; error: string } {
  const str = (key: string, max: number) => (typeof body[key] === 'string' ? (body[key] as string).trim().slice(0, max) : '');
  const name = str('name', 80);
  const emailRaw = str('email', 254).toLowerCase();
  const phoneRaw = str('phone', 30);
  const message = cleanChatBody(body.message);
  if (name.length < 2) return { ok: false, error: 'Enter your name.' };
  if (emailRaw && !EMAIL.test(emailRaw)) return { ok: false, error: 'Check the email.' };
  const phone = phoneRaw ? phone10(phoneRaw) : null;
  if (phoneRaw && !phone) return { ok: false, error: 'Enter a 10-digit phone.' };
  if (!emailRaw && !phone) return { ok: false, error: 'Add a phone or email so we can reply.' };
  if (!message) return { ok: false, error: 'Type a message.' };
  const pageUrl = str('pageUrl', 500);
  return { ok: true, value: { name, email: emailRaw || null, phone, smsConsent: body.smsConsent === true && Boolean(phone), message, pageUrl: /^https?:\/\//.test(pageUrl) ? pageUrl : null } };
}

async function alertOwner(db: Db, thread: { id: string; visitor_name: string }, body: string): Promise<void> {
  const owner = await ownerRecipient(db);
  if (!owner.email) return;
  await sendMessage({
    channel: 'email', to: owner.email, automationKey: 'chat_owner_alert', purpose: 'transactional',
    subject: `Web chat: ${thread.visitor_name}`,
    body: `${thread.visitor_name} wrote:\n\n${body}\n\nReply: ${siteUrl()}/admin/marketing/pages/chat?thread=${thread.id}`,
  }).catch(() => undefined);
}

function autoReply(isOpen: boolean, visitorCount: number, firstName: string): string | null {
  if (isOpen) return visitorCount === 1 ? `Thanks, ${firstName}. A tech will reply right here in a few minutes.` : null;
  return afterHoursPrompt({ hasTruck: visitorCount >= 2, hasService: visitorCount >= 3 });
}

/** New thread: returns the raw token for the httpOnly cookie. Only the hash is stored. */
export async function startThread(input: StartInput, db: Db = createAdminClient(), now = new Date()): Promise<{ token: string }> {
  const token = randomBytes(32).toString('base64url');
  let customerId: string | null = null;
  if (input.email && input.phone) {
    const customer = await findOrCreateCustomer(db, { fullName: input.name, email: input.email, phone: input.phone, smsConsent: input.smsConsent, source: 'web chat' });
    customerId = customer.ok ? customer.data.customerId : null;
  }
  const { data: thread, error } = await db.from('chat_threads').insert({
    token_hash: hashToken(token), visitor_name: input.name, email: input.email, phone: input.phone, sms_consent: input.smsConsent,
    customer_id: customerId, page_url: input.pageUrl, unread_by_shop: 1, last_message_at: now.toISOString(),
  }).select('id, visitor_name').single();
  if (error || !thread) throw new Error(`chat start failed: ${error?.message}`);
  await db.from('chat_messages').insert({ thread_id: thread.id, sender: 'visitor', body: input.message });
  const reply = autoReply(isShopOpen(now, TIME_ZONE, CHAT_HOURS), 1, input.name.split(' ')[0] ?? input.name);
  if (reply) await db.from('chat_messages').insert({ thread_id: thread.id, sender: 'auto', body: reply });
  await alertOwner(db, thread, input.message);
  return { token };
}

async function threadForToken(db: Db, token: string | null) {
  if (!token || !TOKEN.test(token)) return null;
  const { data } = await db.from('chat_threads').select('id, visitor_name, status, unread_by_shop').eq('token_hash', hashToken(token)).maybeSingle();
  return data;
}

export async function postVisitorMessage(token: string | null, raw: unknown, db: Db = createAdminClient(), now = new Date()): Promise<{ ok: boolean; error?: string }> {
  const thread = await threadForToken(db, token);
  if (!thread) return { ok: false, error: 'Chat not found. Start a new one.' };
  const body = cleanChatBody(raw);
  if (!body) return { ok: false, error: 'Type a message.' };
  await db.from('chat_messages').insert({ thread_id: thread.id, sender: 'visitor', body });
  await db.from('chat_threads').update({ unread_by_shop: thread.unread_by_shop + 1, status: 'open', last_message_at: now.toISOString() }).eq('id', thread.id);

  const isOpen = isShopOpen(now, TIME_ZONE, CHAT_HOURS);
  if (!isOpen) {
    const { data: counts } = await db.from('chat_messages').select('sender').eq('thread_id', thread.id);
    const visitorCount = (counts ?? []).filter((m) => m.sender === 'visitor').length;
    const autoCount = (counts ?? []).filter((m) => m.sender === 'auto').length;
    const hasShopReply = (counts ?? []).some((m) => m.sender === 'shop');
    const reply = !hasShopReply && autoCount < MAX_AUTO_PROMPTS ? autoReply(false, visitorCount, '') : null;
    if (reply) await db.from('chat_messages').insert({ thread_id: thread.id, sender: 'auto', body: reply });
  }
  // One alert per burst: only when the shop had caught up.
  if (thread.unread_by_shop === 0) await alertOwner(db, thread, body);
  return { ok: true };
}

export async function readThread(token: string | null, db: Db = createAdminClient()): Promise<ChatThreadView | null> {
  const thread = await threadForToken(db, token);
  if (!thread) return null;
  const { data } = await db.from('chat_messages').select('id, sender, body, created_at').eq('thread_id', thread.id).order('created_at').limit(MAX_MESSAGES_RETURNED);
  return {
    name: thread.visitor_name, status: thread.status === 'closed' ? 'closed' : 'open',
    messages: (data ?? []).map((m) => ({ id: m.id, sender: m.sender as ChatMessageView['sender'], body: m.body, at: m.created_at })),
  };
}

/** Shop reply from the admin. Also texts the visitor when they gave a number and opted in (simulated until Twilio is live). */
export async function postShopReply(threadId: string, raw: unknown, db: Db = createAdminClient(), now = new Date()): Promise<{ ok: boolean; error?: string; texted?: boolean }> {
  const body = cleanChatBody(raw);
  if (!body) return { ok: false, error: 'Type a reply.' };
  const { data: thread } = await db.from('chat_threads').select('id, phone, sms_consent, customer_id').eq('id', threadId).maybeSingle();
  if (!thread) return { ok: false, error: 'Chat not found.' };
  const { error } = await db.from('chat_messages').insert({ thread_id: thread.id, sender: 'shop', body });
  if (error) return { ok: false, error: 'Couldn’t send.' };
  await db.from('chat_threads').update({ unread_by_shop: 0, status: 'open', last_message_at: now.toISOString() }).eq('id', thread.id);
  if (thread.phone && thread.sms_consent && thread.customer_id) {
    const result = await sendMessage({
      channel: 'sms', to: thread.phone, customerId: thread.customer_id, requiresSmsConsent: true, automationKey: 'chat_reply_sms', purpose: 'transactional',
      body: `Lucky Diesel: ${body.slice(0, 280)}`,
    });
    return { ok: true, texted: result.status === 'sent' || result.status === 'simulated' };
  }
  return { ok: true };
}
