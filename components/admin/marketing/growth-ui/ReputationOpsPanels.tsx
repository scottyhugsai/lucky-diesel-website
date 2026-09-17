import { askForVideoTestimonial, decideTestimonial } from '@/app/admin/marketing/reviews/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, fieldClass, labelClass } from '@/components/app/ui';
import { shortDate } from './kit';
import type { ReputationOps } from './reputation-data';

const THEME_LABEL: Record<string, string> = {
  price: 'Price', communication: 'Communication', turnaround: 'Turnaround', quality: 'Quality', honesty: 'Honesty', staff: 'Staff',
};

/** What people keep mentioning, and which replies are late. */
export function ThemesCard({ ops }: { ops: ReputationOps }) {
  const max = Math.max(1, ...ops.themes.map((t) => t.count));
  return (
    <Card title="What they talk about">
      {ops.themes.length === 0 ? (
        <p className="text-sm text-steel">No themes yet. They appear as reviews come in.</p>
      ) : (
        <ul className="grid gap-2">
          {ops.themes.map((theme) => (
            <li key={theme.theme} className="grid gap-1">
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">{THEME_LABEL[theme.theme] ?? theme.theme}</span>
                <span className="font-mono tabular-nums text-steel">{theme.count}</span>
              </span>
              <span aria-hidden="true" className="h-1.5 rounded-full bg-gunmetal">
                <span className="block h-1.5 rounded-full bg-clover" style={{ width: `${Math.round((theme.count / max) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {ops.overdue.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-steel">Replies overdue</p>
          <ul className="grid gap-1.5 text-sm">
            {ops.overdue.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{row.author} · {row.rating}★</span>
                <Badge tone="bad">{row.hours}h / {row.limit}h</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** Review count per month, plus requests sent per staff member (never reviews received). */
export function VelocityCard({ ops }: { ops: ReputationOps }) {
  const max = Math.max(1, ...ops.velocity.map((m) => m.reviews));
  return (
    <Card title="Review pace">
      <ul className="flex items-end gap-2" aria-label="Reviews per month">
        {ops.velocity.map((month) => (
          <li key={month.label} className="grid flex-1 justify-items-center gap-1">
            <span className="font-mono text-xs tabular-nums text-chalk/70">{month.reviews}</span>
            <span aria-hidden="true" className="w-full rounded-t bg-clover/70" style={{ height: `${Math.max(4, Math.round((month.reviews / max) * 64))}px` }} />
            <span className="text-[0.65rem] uppercase tracking-widest text-steel">{month.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-steel">Requests sent</p>
        <ul className="grid gap-1.5 text-sm">
          {ops.requests.map((row) => (
            <li key={row.name} className="flex justify-between gap-3"><span className="min-w-0 truncate">{row.name}</span><span className="font-mono tabular-nums text-steel">{row.sent}</span></li>
          ))}
          {ops.requests.length === 0 && <li className="text-steel">No requests logged yet.</li>}
        </ul>
        <p className="mt-2 text-xs text-steel">We track asks, never reviews received. Quotas break Google’s rules.</p>
      </div>
    </Card>
  );
}

/** Short customer videos: ask, then approve what comes back. */
export function TestimonialsCard({ ops, customers }: { ops: ReputationOps; customers: { id: string; name: string }[] }) {
  return (
    <Card title="Video testimonials">
      <ActionForm action={askForVideoTestimonial} className="mb-4 grid gap-2" aria-label="Ask for a video">
        <label htmlFor="vt-customer"><span className={labelClass}>Customer</span>
          <select id="vt-customer" name="customer_id" className={fieldClass} defaultValue="">
            <option value="" disabled>Pick a customer</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
        </label>
        <PendingButton variant="secondary" size="sm" className="justify-self-start">Send upload link</PendingButton>
      </ActionForm>
      <ul className="grid gap-2">
        {ops.testimonials.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-2 text-sm last:border-b-0">
            <span className="min-w-0 flex-1 truncate">{row.name}<span className="block text-xs text-steel">{shortDate(row.requestedAt, true)}</span></span>
            <Badge tone={row.status === 'approved' ? 'good' : row.status === 'rejected' ? 'bad' : row.status === 'uploaded' ? 'warn' : 'neutral'}>{row.status}</Badge>
            {row.status === 'uploaded' && (
              <>
                <ActionForm action={decideTestimonial} feedback="none" aria-label="Approve video">
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <PendingButton variant="secondary" size="sm">Approve</PendingButton>
                </ActionForm>
                <ActionForm action={decideTestimonial} feedback="none" aria-label="Reject video">
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <PendingButton variant="ghost" size="sm">Reject</PendingButton>
                </ActionForm>
              </>
            )}
          </li>
        ))}
        {ops.testimonials.length === 0 && <li className="text-sm text-steel">None yet.</li>}
      </ul>
    </Card>
  );
}
