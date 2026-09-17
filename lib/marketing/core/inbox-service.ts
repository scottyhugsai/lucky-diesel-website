import 'server-only';
import { writeCopy, type GenerationMeta } from '@/lib/marketing/content/ai';
import { checkContent, type ComplianceReport } from '@/lib/marketing/content/compliance';
import { loadVoice, recordGeneration } from '@/lib/marketing/content/db';
import { sendMessage } from '@/lib/messaging/send';
import { firstName, WORK_ORDER_STATUS } from '@/lib/format';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import { findCustomerByAddress } from './consent';
import { customersByAddress, getShopHours, staffAddresses } from './crm-data';
import {
  bookingLinkFor, classifyReplyIntent, describeHours, groupThreads, hasPrice, templateReply, type InboxChannel, type InboxMessage, type ThreadSummary,
} from './inbox';
import { phoneTail } from './policy';
import type { Db } from './settings';
import { INBOX_REPLY_KEY, isSnoozed } from './speed';

export type InboxFilter = 'open' | 'waiting' | 'mine' | 'snoozed' | 'done';
export const INBOX_FILTERS: readonly InboxFilter[] = ['open', 'waiting', 'mine', 'snoozed', 'done'];

export interface InboxRow extends ThreadSummary {
  name: string;
  assignedTo: string | null;
  snoozedUntil: string | null;
  closed: boolean;
}

const LIST_LIMIT = 1500;

function toInboxMessage(m: { id: string; channel: InboxChannel; direction: 'inbound' | 'outbound'; to_address: string; body: string; subject: string | null; status: string; automation_key: string | null; customer_id: string | null; created_at: string }): InboxMessage {
  return { id: m.id, channel: m.channel, direction: m.direction, address: m.to_address, body: m.body, subject: m.subject, status: m.status, automationKey: m.automation_key, customerId: m.customer_id, createdAt: m.created_at };
}

const MESSAGE_COLUMNS = 'id, channel, direction, to_address, body, subject, status, automation_key, customer_id, created_at';

export async function loadInbox(db: Db, filter: InboxFilter, viewerId: string, now = new Date()): Promise<{ rows: InboxRow[]; counts: Record<InboxFilter, number> }> {
  const [{ data: messages }, staff, { data: states }] = await Promise.all([
    db.from('messages').select(MESSAGE_COLUMNS).neq('status', 'queued').order('created_at', { ascending: false }).limit(LIST_LIMIT),
    staffAddresses(db),
    db.from('inbox_threads').select('channel, address, assigned_to, snoozed_until, closed_at'),
  ]);
  const threads = groupThreads((messages ?? []).map(toInboxMessage), staff);
  const people = await customersByAddress(db, threads.flatMap((t) => (t.customerId ? [t.customerId] : [])));
  const stateByKey = new Map((states ?? []).map((s) => [`${s.channel}:${s.address}`, s]));
  const all: InboxRow[] = threads.map((t) => {
    const state = stateByKey.get(t.key);
    // A new customer message reopens a closed conversation.
    const closed = Boolean(state?.closed_at && state.closed_at >= t.lastAt);
    return { ...t, name: (t.customerId && people.get(t.customerId)?.name) || t.address, assignedTo: state?.assigned_to ?? null, snoozedUntil: state?.snoozed_until ?? null, closed };
  });
  const snoozed = (r: InboxRow) => isSnoozed(r.snoozedUntil ? new Date(r.snoozedUntil) : null, now);
  const test: Record<InboxFilter, (r: InboxRow) => boolean> = {
    open: (r) => !r.closed && !snoozed(r),
    waiting: (r) => !r.closed && !snoozed(r) && r.awaitingReply,
    mine: (r) => !r.closed && r.assignedTo === viewerId,
    snoozed: (r) => !r.closed && snoozed(r),
    done: (r) => r.closed,
  };
  const counts = Object.fromEntries(INBOX_FILTERS.map((f) => [f, all.filter(test[f]).length])) as Record<InboxFilter, number>;
  return { rows: all.filter(test[filter]), counts };
}

export interface ThreadDetail {
  key: string;
  channel: InboxChannel;
  address: string;
  customer: { id: string; name: string; smsOk: boolean } | null;
  lead: { id: string; status: string; serviceId: string | null; platform: string | null; serviceLabel: string | null; platformLabel: string | null } | null;
  messages: InboxMessage[];
  state: { id: string; assignedTo: string | null; snoozedUntil: string | null; closedAt: string | null } | null;
  notes: { id: string; body: string; author: string; createdAt: string }[];
}

function phoneVariants(e164: string): string[] {
  const tail = phoneTail(e164);
  return [e164, tail, `1${tail}`, `(${tail.slice(0, 3)}) ${tail.slice(3, 6)}-${tail.slice(6)}`, `${tail.slice(0, 3)}-${tail.slice(3, 6)}-${tail.slice(6)}`, `${tail.slice(0, 3)}.${tail.slice(3, 6)}.${tail.slice(6)}`];
}

export async function loadThread(db: Db, channel: InboxChannel, address: string): Promise<ThreadDetail> {
  const customerId = await findCustomerByAddress(db, channel, address);
  const variants = channel === 'sms' ? phoneVariants(address) : [address];
  const [byAddress, byCustomer, customer, lead, state] = await Promise.all([
    db.from('messages').select(MESSAGE_COLUMNS).eq('channel', channel).in('to_address', variants).order('created_at').limit(300),
    customerId ? db.from('messages').select(MESSAGE_COLUMNS).eq('channel', channel).eq('customer_id', customerId).order('created_at').limit(300) : Promise.resolve({ data: [] }),
    customerId ? db.from('customers').select('id, full_name, sms_consent, sms_opted_out_at').eq('id', customerId).maybeSingle() : Promise.resolve({ data: null }),
    customerId ? db.from('leads').select('id, status, service_id, platform, service_label, platform_label').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    db.from('inbox_threads').select('id, assigned_to, snoozed_until, closed_at').eq('channel', channel).eq('address', address).maybeSingle(),
  ]);
  const seen = new Map<string, InboxMessage>();
  for (const m of [...(byAddress.data ?? []), ...(byCustomer.data ?? [])]) seen.set(m.id, toInboxMessage(m));
  const messages = [...seen.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const { data: notes } = state.data
    ? await db.from('crm_notes').select('id, body, created_at, profiles(full_name)').eq('thread_id', state.data.id).order('created_at', { ascending: false }).limit(50)
    : { data: [] };
  return {
    key: `${channel}:${address}`, channel, address,
    customer: customer.data ? { id: customer.data.id, name: customer.data.full_name, smsOk: customer.data.sms_consent && !customer.data.sms_opted_out_at } : null,
    lead: lead.data ? { id: lead.data.id, status: lead.data.status, serviceId: lead.data.service_id, platform: lead.data.platform, serviceLabel: lead.data.service_label, platformLabel: lead.data.platform_label } : null,
    messages,
    state: state.data ? { id: state.data.id, assignedTo: state.data.assigned_to, snoozedUntil: state.data.snoozed_until, closedAt: state.data.closed_at } : null,
    notes: (notes ?? []).map((n) => ({ id: n.id, body: n.body, author: n.profiles?.full_name ?? 'Team', createdAt: n.created_at })),
  };
}

/** Upserts the thread's state row and returns its id. */
export async function ensureThread(db: Db, channel: InboxChannel, address: string): Promise<string | null> {
  const customerId = await findCustomerByAddress(db, channel, address);
  const { data, error } = await db.from('inbox_threads').upsert({ channel, address, customer_id: customerId }, { onConflict: 'channel,address' }).select('id').single();
  if (error) console.error(`[crm] could not save thread: ${error.message}`);
  return data?.id ?? null;
}

export interface ReplyDraft {
  text: string;
  generator: GenerationMeta['generator'];
  compliance: ComplianceReport;
}

const MAX_SMS_DRAFT = 320;
const MAX_EMAIL_DRAFT = 900;

/** Inbox reply assistant: template draft in demo, AI draft when connected. Never quotes prices. */
export async function draftReply(db: Db, thread: ThreadDetail, requestedBy: string): Promise<ReplyDraft> {
  const lastInbound = thread.messages.findLast((m) => m.direction === 'inbound');
  const hours = await getShopHours(db);
  const { data: job } = thread.customer
    ? await db.from('work_orders').select('status').eq('customer_id', thread.customer.id).not('status', 'in', '(paid,cancelled)').order('created_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const facts = {
    firstName: firstName(thread.customer?.name ?? ''),
    bookingLink: bookingLinkFor(siteUrl(), { platform: thread.lead?.platform, service: thread.lead?.serviceId }),
    shopPhone: BUSINESS.phoneDisplay,
    jobStatus: job ? WORK_ORDER_STATUS[job.status].customerLabel : null,
    hours: describeHours(hours.openDays, hours.openHour, hours.closeHour),
  };
  const intent = classifyReplyIntent(lastInbound?.body ?? '');
  const fallback = templateReply(intent, facts);
  const { text, meta } = await writeCopy({
    task: 'Draft a short, friendly reply from the shop to the customer\'s latest message. Answer only what you can from the facts. Never quote a price or promise a date. Offer the booking link when it helps.',
    facts: { ...facts, conversation: thread.messages.slice(-6).map((m) => `${m.direction === 'inbound' ? 'Customer' : 'Shop'}: ${m.body.slice(0, 400)}`) },
    maxChars: thread.channel === 'sms' ? MAX_SMS_DRAFT : MAX_EMAIL_DRAFT,
    voice: await loadVoice(db),
    fallback,
  });
  const checked = checkContent([text]);
  const safe = hasPrice(text) || checked.status === 'block' ? fallback : text;
  const compliance = safe === text ? checked : checkContent([safe]);
  const generator = safe === text ? meta.generator : 'demo';
  await recordGeneration(db, { kind: 'assistant', input: { task: 'inbox_reply', intent, thread: thread.key }, output: { text: safe, compliance }, meta: safe === text ? meta : { ...meta, generator: 'demo', fallbackReason: meta.fallbackReason ?? 'draft blocked by guardrails' }, requestedBy });
  return { text: safe, generator, compliance };
}

/** Sends a typed reply through the normal messaging gate and marks a new lead contacted. */
export async function sendReply(db: Db, input: { channel: InboxChannel; address: string; body: string; subject: string | null }): Promise<{ ok: boolean; status: string; error?: string }> {
  const customerId = await findCustomerByAddress(db, input.channel, input.address);
  const result = await sendMessage({
    channel: input.channel, to: input.address, body: input.body, subject: input.channel === 'email' ? input.subject || `Re: ${BUSINESS.name}` : undefined,
    customerId, automationKey: INBOX_REPLY_KEY, purpose: 'transactional',
  });
  const delivered = result.status === 'sent' || result.status === 'simulated';
  if (delivered && customerId) {
    const now = new Date().toISOString();
    await db.from('leads').update({ status: 'contacted', contacted_at: now }).eq('customer_id', customerId).eq('status', 'new');
    await db.from('leads').update({ contacted_at: now }).eq('customer_id', customerId).is('contacted_at', null);
    await db.from('inbox_threads').update({ closed_at: null }).eq('channel', input.channel).eq('address', input.address);
  }
  return { ok: delivered, status: result.status, error: result.error };
}
