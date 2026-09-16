import Link from 'next/link';
import { AutoRefresh } from '@/components/admin/ops/AutoRefresh';
import { DemoPhone, type PhoneThread } from '@/components/admin/ops/DemoPhone';
import { MessageLogTable } from '@/components/admin/ops/MessageLogTable';
import { PageHeader, fieldClass, labelClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import type { Enums } from '@/lib/db/database.types';
import { timeOnly } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Messages | Lucky Diesel admin' };

const CHANNELS: Enums<'message_channel'>[] = ['sms', 'email'];
const STATUSES: Enums<'message_status'>[] = ['sent', 'simulated', 'skipped', 'failed', 'queued'];
const LOG_LIMIT = 200;
const PHONE_LIMIT = 300;

type Search = Promise<{ view?: string; channel?: string; status?: string; thread?: string }>;

export default async function MessagesPage({ searchParams }: { searchParams: Search }) {
  await requireRole('admin');
  const params = await searchParams;
  const view = params.view === 'log' ? 'log' : 'phone';
  const supabase = await createClient();
  const { data: automations } = await supabase.from('automations').select('key, name');
  const names = new Map((automations ?? []).map((a) => [a.key, a.name]));

  const tabs = (
    <nav aria-label="Messages view" className="mb-6 inline-grid grid-cols-2 gap-1 rounded-sm border border-line bg-carbon-2 p-1">
      {(['phone', 'log'] as const).map((v) => (
        <Link key={v} href={`/admin/messages?view=${v}`} aria-current={view === v ? 'page' : undefined} className={`rounded-sm px-4 py-2 text-center text-sm font-semibold ${view === v ? 'bg-gunmetal text-chalk' : 'text-steel hover:text-chalk'}`}>
          {v === 'phone' ? 'Demo Phone' : 'Message log'}
        </Link>
      ))}
    </nav>
  );

  if (view === 'log') {
    const channel = CHANNELS.find((c) => c === params.channel);
    const status = STATUSES.find((s) => s === params.status);
    let query = supabase.from('messages').select('id, channel, to_address, subject, body, status, error, automation_key, created_at, customer_id').order('created_at', { ascending: false }).limit(LOG_LIMIT);
    if (channel) query = query.eq('channel', channel);
    if (status) query = query.eq('status', status);
    const { data: messages, error } = await query;
    return (
      <>
        <PageHeader kicker="Messages" title="Message log" description="Every text and email the system sent, simulated or skipped, with the reason." />
        {tabs}
        <form className="mb-5 grid gap-3 rounded-md border border-line bg-carbon-2 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <input type="hidden" name="view" value="log" />
          <div>
            <label htmlFor="channel" className={labelClass}>Channel</label>
            <select id="channel" name="channel" defaultValue={channel ?? ''} className={fieldClass}>
              <option value="">Text + email</option>
              <option value="sms">Text</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div>
            <label htmlFor="status" className={labelClass}>Status</label>
            <select id="status" name="status" defaultValue={status ?? ''} className={fieldClass}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-go h-11 rounded-sm px-4 font-bold">Filter</button>
        </form>
        {error && <p role="alert" className="mb-4 text-sm text-danger">Couldn’t load messages: {error.message}</p>}
        <div className="rounded-md border border-line bg-carbon-2 sm:p-1">
          <MessageLogTable messages={messages ?? []} names={names} />
        </div>
      </>
    );
  }

  const [{ data: texts }, { data: settings }] = await Promise.all([
    supabase.from('messages').select('id, to_address, body, status, error, automation_key, created_at, customers(full_name)').eq('channel', 'sms').in('status', ['simulated', 'sent', 'skipped']).order('created_at', { ascending: false }).limit(PHONE_LIMIT),
    supabase.from('shop_settings').select('owner_phone').eq('id', 1).maybeSingle(),
  ]);
  const byNumber = new Map<string, PhoneThread>();
  for (const m of [...(texts ?? [])].reverse()) {
    const key = m.to_address.replace(/\D/g, '').slice(-10);
    const name = key === settings?.owner_phone?.replace(/\D/g, '').slice(-10) ? 'Owner (you)' : m.customers?.full_name ?? m.to_address;
    const thread = byNumber.get(key) ?? { number: key, name, messages: [] };
    thread.messages.push({ id: m.id, body: m.body, created_at: m.created_at, status: m.status, error: m.error, automation: m.automation_key ? names.get(m.automation_key) ?? m.automation_key : null });
    byNumber.set(key, thread);
  }
  const threads = [...byNumber.values()].sort((a, b) => (b.messages.at(-1)?.created_at ?? '').localeCompare(a.messages.at(-1)?.created_at ?? ''));
  const active = threads.find((t) => t.number === params.thread) ?? null;
  const threadHref = (number: string) => `/admin/messages?view=phone&thread=${number}`;

  return (
    <>
      <AutoRefresh intervalMs={5000} />
      <PageHeader kicker="Messages" title="Demo Phone" description="Texts land here the instant an automation fires. Live SMS switches on after A2P 10DLC carrier registration." />
      {tabs}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 lg:order-2"><DemoPhone threads={threads} active={active} threadHref={threadHref} listHref="/admin/messages?view=phone" /></div>
        <section aria-labelledby="threads-heading" className="min-w-0 lg:order-1">
          <h2 id="threads-heading" className="kicker mb-3">Conversations</h2>
          <p className="mb-4 flex items-center gap-2 text-xs text-steel"><span className="size-2 animate-pulse rounded-full bg-clover" aria-hidden="true" />Refreshing every 5 seconds</p>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {threads.map((t) => {
              const last = t.messages.at(-1);
              const isActive = active?.number === t.number;
              return (
                <li key={t.number}>
                  <Link href={threadHref(t.number)} scroll={false} aria-current={isActive ? 'true' : undefined} className={`flex items-center gap-3 rounded-md border p-3 transition-colors ${isActive ? 'border-clover bg-clover/10' : 'border-line bg-carbon-2 hover:border-clover/50'}`}>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold">{t.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-steel">{last ? timeOnly(last.created_at) : ''}</span>
                      </span>
                      <span className="block truncate text-sm text-chalk/60">{last?.body}</span>
                    </span>
                    <span className="rounded-full bg-gunmetal px-2 text-xs tabular-nums text-chalk/70">{t.messages.length}</span>
                  </Link>
                </li>
              );
            })}
            {threads.length === 0 && <li className="text-sm text-steel">No texts yet.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
