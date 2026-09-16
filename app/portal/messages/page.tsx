import { Mail, MessageSquare, Phone } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/app/ui';
import { NotLinked } from '@/components/portal/NotLinked';
import { requireRole } from '@/lib/auth';
import { dateOnly, SHOP_TIME_ZONE, timeOnly } from '@/lib/format';
import { BUSINESS } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Messages | Lucky Diesel' };

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIME_ZONE });

export default async function MessagesPage() {
  const viewer = await requireRole('client');
  if (!viewer.customerId) return <NotLinked />;
  const supabase = await createClient();
  // RLS limits this to the signed-in customer's messages; the filter is belt and braces.
  const { data: messages } = await supabase
    .from('messages')
    .select('id, channel, direction, subject, body, created_at, status')
    .eq('customer_id', viewer.customerId)
    .neq('status', 'skipped')
    .order('created_at', { ascending: true })
    .limit(200);

  const days: { key: string; label: string; items: NonNullable<typeof messages> }[] = [];
  for (const message of messages ?? []) {
    const key = dayKey.format(new Date(message.created_at));
    const day = days.at(-1);
    if (day?.key === key) day.items.push(message);
    else days.push({ key, label: dateOnly(message.created_at), items: [message] });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        kicker="Messages"
        title="Texts & emails"
        description="Everything we’ve sent you about your truck."
        actions={
          <a href={BUSINESS.smsHref} className="btn-go inline-flex h-11 items-center gap-2 rounded-sm px-4 font-bold">
            <MessageSquare className="size-4" aria-hidden="true" /> Text the shop
          </a>
        }
      />

      {days.length ? (
        <ol className="space-y-8" aria-label="Message history">
          {days.map((day) => (
            <li key={day.key}>
              <p className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-steel before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
                {day.label}
              </p>
              <ul className="space-y-3">
                {day.items.map((message) => {
                  const fromShop = message.direction === 'outbound';
                  const Icon = message.channel === 'email' ? Mail : MessageSquare;
                  return (
                    <li key={message.id} className={`flex ${fromShop ? 'justify-start' : 'justify-end'}`}>
                      <article className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${fromShop ? 'rounded-bl-sm border border-line bg-carbon-2' : 'rounded-br-sm bg-clover text-carbon'}`}>
                        {message.subject && <p className="font-semibold">{message.subject}</p>}
                        <p className="whitespace-pre-line break-words leading-relaxed">{message.body}</p>
                        <p className={`mt-2 flex items-center gap-1.5 text-xs ${fromShop ? 'text-steel' : 'text-carbon/70'}`}>
                          <Icon className="size-3.5" aria-hidden="true" />
                          <span>{fromShop ? 'Lucky Diesel' : 'You'} · {message.channel === 'email' ? 'Email' : 'Text'} · {timeOnly(message.created_at)}</span>
                        </p>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="No messages yet">Appointment confirmations and job updates will show up here.</EmptyState>
      )}

      <div className="mt-10 flex flex-col items-center gap-2 rounded-md border border-line bg-carbon-2 p-6 text-center">
        <p className="display text-2xl not-italic">Questions about your truck?</p>
        <p className="text-chalk/65">Text or call the shop directly.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <a href={BUSINESS.smsHref} className="inline-flex h-11 items-center gap-2 rounded-sm border border-chalk/20 px-4 font-semibold hover:border-clover hover:text-clover">
            <MessageSquare className="size-4" aria-hidden="true" /> Text {BUSINESS.phoneDisplay}
          </a>
          <a href={BUSINESS.phoneHref} className="inline-flex h-11 items-center gap-2 rounded-sm border border-chalk/20 px-4 font-semibold hover:border-clover hover:text-clover">
            <Phone className="size-4" aria-hidden="true" /> Call
          </a>
        </div>
      </div>
    </div>
  );
}
