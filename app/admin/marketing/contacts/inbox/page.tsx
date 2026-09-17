import Link from 'next/link';
import { Mail, MessageSquare } from 'lucide-react';
import { addThreadNoteAction, assignThreadAction, closeChatAction, closeThreadAction, deleteSnippetAction, replyToChatAction, saveSnippetAction, sendBookLinkAction, snoozeThreadAction } from './actions';
import { ReplyComposer } from '@/components/admin/marketing/crm/ReplyComposer';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, EmptyState, PageHeader, fieldClass, labelClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { dateTime, relativeTime } from '@/lib/format';
import { getCrmSettings, teamMembers } from '@/lib/marketing/core/crm-data';
import { bookingLinkFor, parseThreadKey } from '@/lib/marketing/core/inbox';
import { INBOX_FILTERS, loadInbox, loadThread, type InboxFilter } from '@/lib/marketing/core/inbox-service';
import { isSnoozed } from '@/lib/marketing/core/speed';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import { sweepSoon } from '@/lib/marketing/core/crm-sweep';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Inbox | Marketing' };

const FILTER_LABEL: Record<InboxFilter, string> = { open: 'Open', waiting: 'Waiting on us', mine: 'Mine', snoozed: 'Snoozed', done: 'Done' };
const SNOOZE_OPTIONS = [
  { hours: 3, label: '3 hours' },
  { hours: 24, label: 'Tomorrow' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: 'Next week' },
];

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function filterFrom(raw: string | undefined): InboxFilter {
  return (INBOX_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as InboxFilter) : 'open';
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ f?: string | string[]; t?: string | string[] }> }) {
  const viewer = await requireRole('admin');
  const params = await searchParams;
  const filter = filterFrom(one(params.f));
  const db = createAdminClient();
  await sweepSoon();
  const [{ rows, counts }, settings, team, { data: snippets }, { data: chats }] = await Promise.all([
    loadInbox(db, filter, viewer.userId),
    getCrmSettings(db),
    teamMembers(db),
    db.from('reply_snippets').select('id, title, body').order('sort').limit(30),
    db.from('chat_threads')
      .select('id, visitor_name, phone, email, status, unread_by_shop, last_message_at, page_url, chat_messages(id, sender, body, created_at)')
      .neq('status', 'closed')
      .order('last_message_at', { ascending: false })
      .limit(10),
  ]);

  const selectedKey = one(params.t) ?? rows[0]?.key;
  const parsed = selectedKey ? parseThreadKey(selectedKey) : null;
  const thread = parsed ? await loadThread(db, parsed.channel, parsed.address) : null;
  const snoozedNow = thread?.state?.snoozedUntil ? isSnoozed(new Date(thread.state.snoozedUntil), new Date()) : false;
  const blocked = thread?.channel === 'sms' && thread.customer && !thread.customer.smsOk ? 'This customer opted out of texts.' : null;

  return (
    <>
      <PageHeader
        kicker="Contacts"
        title="Inbox"
        description={`Texts and email in one thread per person. Reply within ${settings.slaFirstMinutes} minutes.`}
      />

      <nav aria-label="Inbox filters" className="mb-4 flex flex-wrap gap-2">
        {INBOX_FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/marketing/contacts/inbox?f=${f}`}
            aria-current={filter === f ? 'page' : undefined}
            className={`inline-flex h-8 items-center gap-1.5 rounded-sm border px-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
              filter === f ? 'border-clover bg-clover/12 text-clover' : 'border-line text-steel hover:text-chalk'
            }`}
          >
            {FILTER_LABEL[f]}
            <span className="font-mono tabular-nums">{counts[f]}</span>
          </Link>
        ))}
      </nav>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card title={`${FILTER_LABEL[filter]} conversations`} padded={false} className="min-w-0">
          {rows.length === 0 ? (
            <EmptyState title="Nothing here">Inbound texts and email show up as soon as they arrive.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {rows.slice(0, 60).map((row) => (
                <li key={row.key}>
                  <Link
                    href={`/admin/marketing/contacts/inbox?f=${filter}&t=${encodeURIComponent(row.key)}`}
                    aria-current={row.key === selectedKey ? 'true' : undefined}
                    className={`block px-4 py-3 transition-colors hover:bg-gunmetal ${row.key === selectedKey ? 'bg-gunmetal' : ''}`}
                  >
                    <p className="flex items-center gap-2">
                      {row.channel === 'sms' ? <MessageSquare className="size-3.5 shrink-0 text-clover" aria-hidden="true" /> : <Mail className="size-3.5 shrink-0 text-clover" aria-hidden="true" />}
                      <span className="min-w-0 flex-1 truncate font-semibold">{row.name}</span>
                      {row.awaitingReply && <Badge tone="warn">Needs reply</Badge>}
                    </p>
                    <p className="mt-1 truncate text-sm text-chalk/60">{row.preview}</p>
                    <p className="mt-0.5 text-xs text-steel">{relativeTime(row.lastAt)} · {row.count} message{row.count === 1 ? '' : 's'}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid min-w-0 content-start gap-6">
          {thread ? (
            <>
              <Card
                title={thread.customer?.name ?? thread.address}
                action={<span className="text-xs text-steel">{thread.channel === 'sms' ? 'Text' : 'Email'} · {thread.address}</span>}
                padded={false}
                className="min-w-0"
              >
                <ol className="grid max-h-[28rem] gap-2 overflow-y-auto p-4">
                  {thread.messages.slice(-40).map((message) => (
                    <li
                      key={message.id}
                      className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${message.direction === 'inbound' ? 'bg-gunmetal' : 'justify-self-end bg-clover/12 text-chalk'}`}
                    >
                      {message.subject && <p className="mb-1 font-semibold">{message.subject}</p>}
                      <p className="whitespace-pre-line">{message.body}</p>
                      <p className="mt-1 text-xs text-steel">
                        {message.direction === 'inbound' ? 'Them' : message.automationKey ? 'Automation' : 'Us'} · {dateTime(message.createdAt)}
                      </p>
                    </li>
                  ))}
                  {thread.messages.length === 0 && <li className="text-sm text-steel">No messages yet.</li>}
                </ol>

                <ReplyComposer
                  threadKey={thread.key}
                  channel={thread.channel}
                  snippets={snippets ?? []}
                  bookingLink={bookingLinkFor(siteUrl(), { platform: thread.lead?.platform, service: thread.lead?.serviceId })}
                  shopPhone={BUSINESS.phoneDisplay}
                  blocked={blocked}
                />
              </Card>

              <div className="grid min-w-0 gap-6 lg:grid-cols-2">
                <Card title="This conversation">
                  <div className="grid gap-3">
                    {thread.customer && (
                      <Link href={`/admin/marketing/contacts/${thread.customer.id}`} className="text-sm font-semibold text-clover hover:underline">Open contact</Link>
                    )}
                    <ActionForm action={sendBookLinkAction} feedback="below" aria-label="Send booking link">
                      <input type="hidden" name="thread" value={thread.key} />
                      <PendingButton variant="secondary" size="sm">Text the booking link</PendingButton>
                    </ActionForm>

                    <ActionForm action={assignThreadAction} className="grid gap-2" aria-label="Assign">
                      <input type="hidden" name="thread" value={thread.key} />
                      <label htmlFor="assigned_to"><span className={labelClass}>Owner</span>
                        <select id="assigned_to" name="assigned_to" className={fieldClass} defaultValue={thread.state?.assignedTo ?? ''}>
                          <option value="">Unassigned</option>
                          {team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                        </select>
                      </label>
                      <PendingButton variant="secondary" size="sm" className="justify-self-start">Save owner</PendingButton>
                    </ActionForm>

                    <ActionForm action={snoozeThreadAction} className="grid gap-2" aria-label="Snooze">
                      <input type="hidden" name="thread" value={thread.key} />
                      <label htmlFor="snooze-hours"><span className={labelClass}>Snooze</span>
                        <select id="snooze-hours" name="hours" className={fieldClass} defaultValue="24">
                          {SNOOZE_OPTIONS.map((o) => <option key={o.hours} value={o.hours}>{o.label}</option>)}
                          <option value="0">Clear snooze</option>
                        </select>
                      </label>
                      <p className="text-xs text-steel">{snoozedNow ? `Snoozed until ${dateTime(thread.state!.snoozedUntil!)}.` : 'Hides it until then. A new message brings it back.'}</p>
                      <PendingButton variant="secondary" size="sm" className="justify-self-start">Snooze</PendingButton>
                    </ActionForm>

                    <ActionForm action={closeThreadAction} feedback="below" aria-label="Mark done">
                      <input type="hidden" name="thread" value={thread.key} />
                      {thread.state?.closedAt && <input type="hidden" name="reopen" value="1" />}
                      <PendingButton variant="ghost" size="sm">{thread.state?.closedAt ? 'Reopen' : 'Mark done'}</PendingButton>
                    </ActionForm>
                  </div>
                </Card>

                <Card title="Notes">
                  <ActionForm action={addThreadNoteAction} resetOnSuccess className="mb-3 grid gap-2" aria-label="Add note">
                    <input type="hidden" name="thread" value={thread.key} />
                    <label htmlFor="note-body" className="sr-only">Note</label>
                    <textarea id="note-body" name="body" rows={2} maxLength={2000} className={`${fieldClass} h-auto py-2`} placeholder="What was agreed…" />
                    <PendingButton variant="secondary" size="sm" className="justify-self-start">Save note</PendingButton>
                  </ActionForm>
                  <ol className="grid gap-2">
                    {thread.notes.map((note) => (
                      <li key={note.id} className="border-b border-line pb-2 text-sm last:border-b-0">
                        <p className="whitespace-pre-line text-chalk/85">{note.body}</p>
                        <p className="mt-0.5 text-xs text-steel">{note.author} · {dateTime(note.createdAt)}</p>
                      </li>
                    ))}
                    {thread.notes.length === 0 && <li className="text-sm text-steel">No notes yet.</li>}
                  </ol>
                </Card>
              </div>
            </>
          ) : (
            <EmptyState title="Pick a conversation">Choose one on the left to read and reply.</EmptyState>
          )}

          <Card title={`Web chat${(chats ?? []).length ? ` · ${(chats ?? []).length} open` : ''}`}>
            {(chats ?? []).length === 0 ? (
              <p className="text-sm text-steel">No chats open. The bubble on the site starts them.</p>
            ) : (
              <ul className="grid gap-4">
                {(chats ?? []).map((chat) => (
                  <li key={chat.id} className="border-b border-line pb-4 last:border-b-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{chat.visitor_name}</span>
                      {chat.unread_by_shop > 0 && <Badge tone="warn">New</Badge>}
                      <span className="text-xs text-steel">{chat.phone ?? chat.email} · {relativeTime(chat.last_message_at)}</span>
                    </p>
                    <ol className="mt-2 grid max-h-40 gap-1.5 overflow-y-auto text-sm">
                      {(chat.chat_messages ?? []).slice(-6).map((message) => (
                        <li key={message.id} className={`rounded-sm px-2 py-1 ${message.sender === 'visitor' ? 'bg-gunmetal' : 'bg-clover/10'}`}>
                          <span className="text-[0.65rem] uppercase tracking-widest text-steel">{message.sender}</span>
                          <span className="block whitespace-pre-line text-chalk/85">{message.body}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <ActionForm action={replyToChatAction} resetOnSuccess className="flex min-w-0 flex-1 items-end gap-2" aria-label="Reply to chat">
                        <input type="hidden" name="thread_id" value={chat.id} />
                        <label className="sr-only" htmlFor={`chat-${chat.id}`}>Reply</label>
                        <input id={`chat-${chat.id}`} name="body" maxLength={1000} className={fieldClass} placeholder="Reply…" />
                        <PendingButton size="sm">Send</PendingButton>
                      </ActionForm>
                      <ActionForm action={closeChatAction} feedback="none" aria-label="Close chat">
                        <input type="hidden" name="thread_id" value={chat.id} />
                        <PendingButton variant="ghost" size="sm">Close</PendingButton>
                      </ActionForm>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Snippets">
            <ul className="mb-3 grid gap-2">
              {(snippets ?? []).map((snippet) => (
                <li key={snippet.id} className="flex items-start justify-between gap-3 border-b border-line pb-2 text-sm last:border-b-0">
                  <span className="min-w-0"><span className="font-semibold">{snippet.title}</span><span className="block text-xs text-chalk/60">{snippet.body}</span></span>
                  <ActionForm action={deleteSnippetAction} feedback="none" confirm="Delete this snippet?" aria-label="Delete snippet">
                    <input type="hidden" name="id" value={snippet.id} />
                    <PendingButton variant="ghost" size="sm">Delete</PendingButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
            <ActionForm action={saveSnippetAction} resetOnSuccess className="grid gap-2" aria-label="Add snippet">
              <label htmlFor="snippet-title"><span className={labelClass}>Title</span><input id="snippet-title" name="title" maxLength={60} className={fieldClass} placeholder="Waiting on parts" /></label>
              <label htmlFor="snippet-body"><span className={labelClass}>Text</span><textarea id="snippet-body" name="body" rows={2} maxLength={1000} className={`${fieldClass} h-auto py-2`} placeholder="Use {{booking_link}} and {{shop_phone}}." /></label>
              <PendingButton variant="secondary" size="sm" className="justify-self-start">Add snippet</PendingButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
