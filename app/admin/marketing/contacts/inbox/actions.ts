'use server';

import { revalidatePath } from 'next/cache';
import { fail, isUuid, numberIn, ok, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import { postShopReply } from '@/lib/marketing/engage/chat';
import { bookingLinkFor, parseThreadKey } from '@/lib/marketing/core/inbox';
import { draftReply, ensureThread, loadThread, sendReply } from '@/lib/marketing/core/inbox-service';
import { sendMessage } from '@/lib/messaging/send';
import { INBOX_REPLY_KEY } from '@/lib/marketing/core/speed';
import { siteUrl } from '@/lib/site-url';
import { createAdminClient } from '@/lib/supabase/admin';

const INBOX = '/admin/marketing/contacts/inbox';
const MAX_BODY = 1200;
const MAX_SNOOZE_HOURS = 720;

export interface DraftState extends ActionState {
  /** Suggested reply text, shown in the composer. */
  draft?: string;
}

function refresh(key?: string) {
  revalidatePath(INBOX);
  if (key) revalidatePath(`${INBOX}?t=${key}`);
  revalidatePath('/admin/marketing/contacts/tasks');
}

/** Inbox reply assistant: a draft the owner edits before sending. Never quotes a price. */
export async function suggestReplyAction(_prev: DraftState, formData: FormData): Promise<DraftState> {
  const viewer = await requireRole('admin');
  const thread = parseThreadKey(formData.get('thread'));
  if (!thread) return fail('Unknown conversation.');
  const db = createAdminClient();
  const detail = await loadThread(db, thread.channel, thread.address);
  if (!detail.messages.length) return fail('Nothing to reply to yet.');
  const result = await draftReply(db, detail, viewer.userId);
  return { draft: result.text, notice: result.generator === 'demo' ? 'Draft ready (template).' : 'Draft ready.', at: Date.now() };
}

export async function sendReplyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const thread = parseThreadKey(formData.get('thread'));
  if (!thread) return fail('Unknown conversation.');
  const body = str(formData, 'body').slice(0, MAX_BODY);
  if (body.length < 2) return fail('Write a reply first.');
  const db = createAdminClient();
  await ensureThread(db, thread.channel, thread.address);
  const result = await sendReply(db, { channel: thread.channel, address: thread.address, body, subject: str(formData, 'subject').slice(0, 120) || null });
  refresh(`${thread.channel}:${thread.address}`);
  if (!result.ok) return fail(result.error ?? 'Could not send that.');
  return ok(result.status === 'simulated' ? 'Sent (demo).' : 'Sent.');
}

/** Text-to-book: sends the booking link with the truck and service pre-filled. */
export async function sendBookLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const thread = parseThreadKey(formData.get('thread'));
  if (!thread) return fail('Unknown conversation.');
  const db = createAdminClient();
  const detail = await loadThread(db, thread.channel, thread.address);
  const link = bookingLinkFor(siteUrl(), { platform: detail.lead?.platform, service: detail.lead?.serviceId });
  const result = await sendMessage({
    channel: thread.channel, to: thread.address, body: `Grab a time that works for you: ${link}`,
    subject: thread.channel === 'email' ? 'Book your spot' : undefined,
    customerId: detail.customer?.id ?? null, automationKey: INBOX_REPLY_KEY, purpose: 'transactional',
  });
  refresh(`${thread.channel}:${thread.address}`);
  if (result.status !== 'sent' && result.status !== 'simulated') return fail(result.error ?? 'Could not send the link.');
  return ok(result.status === 'simulated' ? 'Link sent (demo).' : 'Link sent.');
}

type ThreadPatch = { assigned_to?: string | null; snoozed_until?: string | null; closed_at?: string | null };

async function patchThread(formData: FormData, patch: ThreadPatch, notice: string): Promise<ActionState> {
  await requireRole('admin');
  const thread = parseThreadKey(formData.get('thread'));
  if (!thread) return fail('Unknown conversation.');
  const db = createAdminClient();
  const id = await ensureThread(db, thread.channel, thread.address);
  if (!id) return fail('Could not save that.');
  const { error } = await db.from('inbox_threads').update(patch).eq('id', id);
  if (error) return fail('Could not save that.');
  refresh(`${thread.channel}:${thread.address}`);
  return ok(notice);
}

export async function assignThreadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const assignee = str(formData, 'assigned_to');
  if (assignee && !isUuid(assignee)) return fail('Pick someone.');
  return patchThread(formData, { assigned_to: assignee || null }, assignee ? 'Assigned.' : 'Unassigned.');
}

export async function snoozeThreadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const hours = numberIn(formData, 'hours', 0, MAX_SNOOZE_HOURS, { integer: true });
  if (hours === null) return fail('Pick a time.');
  const until = hours === 0 ? null : new Date(Date.now() + hours * 3_600_000).toISOString();
  return patchThread(formData, { snoozed_until: until }, until ? 'Snoozed.' : 'Snooze cleared.');
}

export async function closeThreadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const reopen = str(formData, 'reopen') === '1';
  return reopen
    ? patchThread(formData, { closed_at: null, snoozed_until: null }, 'Reopened.')
    : patchThread(formData, { closed_at: new Date().toISOString() }, 'Marked done.');
}

export async function addThreadNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  const thread = parseThreadKey(formData.get('thread'));
  if (!thread) return fail('Unknown conversation.');
  const body = str(formData, 'body').slice(0, 2000);
  if (body.length < 2) return fail('Write a note first.');
  const db = createAdminClient();
  const id = await ensureThread(db, thread.channel, thread.address);
  if (!id) return fail('Could not save the note.');
  const { error } = await db.from('crm_notes').insert({ thread_id: id, author_id: viewer.userId, body });
  if (error) return fail('Could not save the note.');
  refresh(`${thread.channel}:${thread.address}`);
  return ok('Note saved.');
}

export async function saveSnippetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const title = str(formData, 'title').slice(0, 60);
  const body = str(formData, 'body').slice(0, 1000);
  if (!title || !body) return fail('Title and text are required.');
  const db = createAdminClient();
  const { error } = await db.from('reply_snippets').insert({ title, body, sort: 100 });
  if (error) return fail('Could not save the snippet.');
  refresh();
  return ok('Snippet saved.');
}

export async function deleteSnippetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = str(formData, 'id');
  if (!isUuid(id)) return fail('Unknown snippet.');
  const db = createAdminClient();
  const { error } = await db.from('reply_snippets').delete().eq('id', id);
  if (error) return fail('Could not delete the snippet.');
  refresh();
  return ok('Snippet deleted.');
}

/** Replies to a web-chat thread. Texts them too when they opted in. */
export async function replyToChatAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const threadId = str(formData, 'thread_id');
  if (!isUuid(threadId)) return fail('Unknown chat.');
  const result = await postShopReply(threadId, formData.get('body'));
  revalidatePath(INBOX);
  if (!result.ok) return fail(result.error ?? 'Could not send that.');
  return ok(result.texted ? 'Sent, and texted them.' : 'Sent.');
}

/** Closes a web-chat thread. A new visitor message reopens it. */
export async function closeChatAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');
  const threadId = str(formData, 'thread_id');
  if (!isUuid(threadId)) return fail('Unknown chat.');
  const { error } = await createAdminClient().from('chat_threads').update({ status: 'closed' }).eq('id', threadId);
  if (error) return fail('Could not close it.');
  revalidatePath(INBOX);
  return ok('Closed.');
}
