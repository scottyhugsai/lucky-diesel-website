import Link from 'next/link';
import { Mail, MessageSquare, Sparkles } from 'lucide-react';
import { createFromTemplateAction } from '@/app/admin/marketing/campaigns/draft-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { MONTHS, SEASONAL_TEMPLATES } from '@/components/admin/marketing/core-ui/seasonal';
import { Badge, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { getMarketingSettings } from '@/lib/marketing/core/settings';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Seasonal calendar | Marketing' };

export default async function SeasonalPage() {
  await requireRole('admin');
  const db = createAdminClient();
  const [settings, { data: campaigns }] = await Promise.all([
    getMarketingSettings(db),
    db.from('campaigns').select('id, name, status, seasonal_key').not('seasonal_key', 'is', null).neq('status', 'archived'),
  ]);
  const month = Number(new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: settings.timeZone }).format(new Date()));

  return (
    <>
      <PageHeader kicker="Campaigns" title="Seasonal calendar" description="Charleston’s year. One tap starts a draft." />

      <section aria-label="Year at a glance" className="mb-8 overflow-hidden rounded-md border border-line bg-carbon-2">
        <div className="grid grid-cols-12 border-b border-line text-center text-[0.62rem] font-bold uppercase tracking-widest text-steel sm:text-xs">
          {MONTHS.map((m, i) => (
            <span key={m} className={`py-2 ${i + 1 === month ? 'bg-clover/15 text-clover' : ''}`}>{m.slice(0, 1)}<span className="hidden sm:inline">{m.slice(1)}</span></span>
          ))}
        </div>
        <ul className="grid gap-1.5 p-2">
          {SEASONAL_TEMPLATES.map((t) => {
            const start = Math.min(...t.months);
            const end = Math.max(...t.months);
            const anchor = end > 8 ? { right: `${((12 - end) / 12) * 100}%` } : { left: `${((start - 1) / 12) * 100}%` };
            return (
              <li key={t.key} className="relative grid h-11 grid-cols-12 items-end">
                <span className={`absolute top-0 whitespace-nowrap text-xs font-semibold text-chalk/85 ${end > 8 ? 'text-right' : ''}`} style={anchor}>{t.name}</span>
                <span className="h-3 rounded-full bg-clover/70" style={{ gridColumn: `${start} / ${end + 1}` }} aria-hidden="true" />
              </li>
            );
          })}
        </ul>
      </section>

      <ul className="grid gap-4 md:grid-cols-2">
        {SEASONAL_TEMPLATES.map((t) => {
          const existing = (campaigns ?? []).filter((c) => c.seasonal_key === t.key);
          const inSeason = t.months.includes(month) || t.months.includes(month + 1);
          const autoOn = t.toggle ? settings.seasonal[t.toggle] !== false : null;
          const ChannelIcon = t.channel === 'sms' ? MessageSquare : Mail;
          return (
            <li key={t.key} className={`flex flex-col rounded-md border bg-carbon-2 p-5 ${inSeason ? 'border-clover/45' : 'border-line'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-steel">{t.window}</span>
                {inSeason && <Badge tone="good">Coming up</Badge>}
                {autoOn !== null && <Badge tone={autoOn ? 'info' : 'neutral'}>Auto {autoOn ? 'on' : 'off'}</Badge>}
              </div>
              <h2 className="display mt-2 text-3xl not-italic">{t.name}</h2>
              <p className="mt-1 text-sm text-chalk/65">{t.pitch}</p>
              <p className="mt-3 flex items-start gap-2 rounded-sm border border-line bg-carbon p-3 text-sm text-chalk/75">
                <ChannelIcon className="mt-0.5 size-4 shrink-0 text-steel" aria-hidden="true" />
                <span className="line-clamp-3">{t.subject || t.body}</span>
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <ActionForm action={createFromTemplateAction}>
                  <input type="hidden" name="key" value={t.key} />
                  <PendingButton size="sm"><Sparkles className="size-4" aria-hidden="true" /> Create from template</PendingButton>
                </ActionForm>
                {existing.map((c) => (
                  <Link key={c.id} href={`/admin/marketing/campaigns/${c.id}`} className="text-sm font-semibold text-clover hover:underline">{c.name} · {c.status}</Link>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-sm text-steel">Automatic seasonal texts follow the toggles in <Link href="/admin/marketing/settings#seasonal" className="text-clover hover:underline">Settings</Link>.</p>
    </>
  );
}
