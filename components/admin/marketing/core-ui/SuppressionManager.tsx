import { Mail, MessageSquare, X } from 'lucide-react';
import { addSuppressionAction, removeSuppressionAction } from '@/app/admin/marketing/settings/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, fieldClass } from '@/components/app/ui';
import type { Tables } from '@/lib/db/database.types';
import { dateOnly } from '@/lib/format';

const REASON_LABEL: Record<string, string> = {
  keyword_stop: 'Texted STOP', stop: 'STOP', natural_language: 'Asked to stop', unsubscribe_link: 'Unsubscribed', bounce: 'Bounced',
  complaint: 'Spam complaint', dnc: 'Do not contact', manual: 'Owner', owner: 'Owner',
};

export function SuppressionManager({ rows }: { rows: Tables<'suppressions'>[] }) {
  return (
    <div className="grid gap-4">
      <ActionForm action={addSuppressionAction} resetOnSuccess className="grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)_10rem_auto]">
        <label><span className="sr-only">Channel</span>
          <select name="channel" className={fieldClass}><option value="email">Email</option><option value="sms">Text</option></select>
        </label>
        <label><span className="sr-only">Email or phone</span>
          <input name="address" required maxLength={254} placeholder="Email or phone" className={fieldClass} />
        </label>
        <label><span className="sr-only">Reason</span>
          <select name="reason" className={fieldClass}>
            <option value="dnc">Do not contact</option>
            <option value="manual">Owner request</option>
            <option value="complaint">Complaint</option>
            <option value="bounce">Bounced</option>
          </select>
        </label>
        <PendingButton variant="danger">Suppress</PendingButton>
      </ActionForm>

      {rows.length ? (
        <ul className="grid gap-px overflow-hidden rounded-md border border-line bg-line">
          {rows.map((row) => {
            const locked = row.scope === 'all' || row.reason === 'keyword_stop' || row.reason === 'stop';
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-carbon px-3 py-2.5">
                {row.channel === 'sms' ? <MessageSquare className="size-4 text-steel" aria-label="Text" /> : <Mail className="size-4 text-steel" aria-label="Email" />}
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{row.address}</span>
                <Badge tone={locked ? 'bad' : 'warn'}>{REASON_LABEL[row.reason] ?? row.reason}</Badge>
                <span className="text-xs text-steel">{row.scope === 'all' ? 'All messages' : 'Marketing'} · {dateOnly(row.created_at)}</span>
                {locked ? (
                  <span className="w-8" title="Only the customer can undo STOP" />
                ) : (
                  <ActionForm action={removeSuppressionAction} confirm={`Remove ${row.address} from the list?`}>
                    <input type="hidden" name="id" value={row.id} />
                    <PendingButton variant="ghost" size="sm" aria-label={`Remove ${row.address}`}><X className="size-4" aria-hidden="true" /></PendingButton>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-steel">Nobody suppressed.</p>
      )}
    </div>
  );
}
