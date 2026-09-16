import Link from 'next/link';
import { Mail, MessageSquare } from 'lucide-react';
import { Badge, EmptyState, TableWrap, tableClass } from '@/components/app/ui';
import type { Tables } from '@/lib/db/database.types';
import { dateTime } from '@/lib/format';

export type MessageRow = Pick<Tables<'messages'>, 'id' | 'channel' | 'to_address' | 'subject' | 'body' | 'status' | 'error' | 'automation_key' | 'created_at' | 'customer_id'>;

export const MESSAGE_TONE = { queued: 'neutral', sent: 'good', simulated: 'violet', failed: 'bad', skipped: 'warn' } as const;

export function MessageLogTable({ messages, names }: { messages: MessageRow[]; names: Map<string, string> }) {
  if (!messages.length) return <EmptyState title="No messages">Nothing matches these filters yet.</EmptyState>;
  return (
    <TableWrap>
      <table className={tableClass}>
        <thead>
          <tr>
            <th scope="col">Channel</th>
            <th scope="col">To</th>
            <th scope="col">Message</th>
            <th scope="col">Status</th>
            <th scope="col">Automation</th>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((m) => (
            <tr key={m.id} className="align-top">
              <td>
                <span className="inline-flex items-center gap-1.5 text-chalk/80">
                  {m.channel === 'sms' ? <MessageSquare className="size-4" aria-hidden="true" /> : <Mail className="size-4" aria-hidden="true" />}
                  {m.channel === 'sms' ? 'Text' : 'Email'}
                </span>
              </td>
              <td className="max-w-[12rem] break-words">
                {m.customer_id ? <Link href={`/admin/customers/${m.customer_id}`} className="hover:text-clover">{m.to_address}</Link> : m.to_address}
              </td>
              <td className="max-w-[24rem]">
                {m.subject && <p className="font-semibold">{m.subject}</p>}
                <p className="line-clamp-2 text-chalk/65">{m.body}</p>
              </td>
              <td>
                <Badge tone={MESSAGE_TONE[m.status]}>{m.status}</Badge>
                {m.error && <p className="mt-1 max-w-[14rem] break-words text-xs text-chalk/55">{m.error.slice(0, 160)}</p>}
              </td>
              <td className="text-chalk/75">
                {m.automation_key ? <Link href={`/admin/automations/${m.automation_key}`} className="hover:text-clover">{names.get(m.automation_key) ?? m.automation_key}</Link> : <span className="text-steel">Manual</span>}
              </td>
              <td className="whitespace-nowrap tabular-nums text-chalk/60">{dateTime(m.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
