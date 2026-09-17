import { Download, FileText } from 'lucide-react';
import { BrandVoiceForm, SeasonalToggles, SendingRulesForm } from '@/components/admin/marketing/core-ui/SettingsForms';
import { SuppressionManager } from '@/components/admin/marketing/core-ui/SuppressionManager';
import { Badge, buttonClass, Card, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { dateOnly } from '@/lib/format';
import { SMS_CONSENT_TEXT, SMS_CONSENT_VERSION } from '@/lib/lead';
import { getMarketingSettings } from '@/lib/marketing/core/settings';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Marketing settings | Marketing' };

const SECTIONS = [
  { id: 'sending', label: 'Sending rules' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'voice', label: 'Brand voice' },
  { id: 'consent', label: 'Consent text' },
  { id: 'suppressions', label: 'Suppressions' },
  { id: 'exports', label: 'Exports' },
  { id: 'channels', label: 'Channels' },
];

const CHANNEL_TONE = { connected: 'good', demo: 'warn', not_connected: 'neutral', expired: 'bad', error: 'bad', revoked: 'bad' } as const;

export default async function MarketingSettingsPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const [settings, { data: voice }, { data: suppressions }, { data: consentEvents }, { data: connections }] = await Promise.all([
    getMarketingSettings(createAdminClient()),
    supabase.from('brand_voice').select('*').eq('id', 1).maybeSingle(),
    supabase.from('suppressions').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('contact_consent_events').select('consent_text_version, created_at, action').eq('action', 'granted').not('consent_text_version', 'is', null).limit(5000),
    supabase.from('channel_connections').select('platform, status, account_name').order('platform'),
  ]);

  const versions = new Map<string, { count: number; first: string; last: string }>();
  for (const e of consentEvents ?? []) {
    const v = versions.get(e.consent_text_version!) ?? { count: 0, first: e.created_at, last: e.created_at };
    versions.set(e.consent_text_version!, { count: v.count + 1, first: e.created_at < v.first ? e.created_at : v.first, last: e.created_at > v.last ? e.created_at : v.last });
  }
  const smsLive = process.env.MESSAGING_SMS_MODE === 'live';
  const demoInbox = Boolean(process.env.DEMO_EMAIL_TO?.trim());

  return (
    <>
      <PageHeader kicker="Marketing" title="Settings" description="Rules every campaign and automation follows." />
      <nav aria-label="Settings sections" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1.5">
          {SECTIONS.map((s) => (
            <li key={s.id}><a href={`#${s.id}`} className="inline-flex h-8 items-center rounded-full border border-line px-3 text-xs font-semibold text-chalk/75 hover:border-clover hover:text-clover">{s.label}</a></li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-6">
        <section id="sending" className="scroll-mt-32"><Card title="Sending rules"><SendingRulesForm settings={settings} /></Card></section>
        <section id="seasonal" className="scroll-mt-32"><Card title="Seasonal plays"><SeasonalToggles settings={settings} /></Card></section>
        <section id="voice" className="scroll-mt-32"><Card title="Brand voice"><BrandVoiceForm voice={voice} /></Card></section>

        <section id="consent" className="scroll-mt-32">
          <Card title="Consent text versions">
            <div className="rounded-sm border border-clover/35 bg-clover/[0.05] p-3">
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold">Live on forms <Badge tone="good">v{SMS_CONSENT_VERSION}</Badge></p>
              <p className="mt-1.5 text-sm leading-relaxed text-chalk/75">{SMS_CONSENT_TEXT}</p>
            </div>
            <ul className="mt-3 grid gap-px overflow-hidden rounded-md border border-line bg-line">
              {[...versions.entries()].sort((a, b) => b[1].last.localeCompare(a[1].last)).map(([version, v]) => (
                <li key={version} className="flex flex-wrap items-center justify-between gap-2 bg-carbon px-3 py-2 text-sm">
                  <span className="flex items-center gap-2"><FileText className="size-4 text-steel" aria-hidden="true" /><span className="font-mono">{version}</span></span>
                  <span className="text-steel">{v.count} opt-in{v.count === 1 ? '' : 's'} · {dateOnly(v.first)} – {dateOnly(v.last)}</span>
                </li>
              ))}
              {versions.size === 0 && <li className="bg-carbon px-3 py-2 text-sm text-steel">No opt-ins recorded yet.</li>}
            </ul>
            <p className="mt-2 text-xs text-steel">Every opt-in stores the version it agreed to. Change wording in the lead form, then bump the version.</p>
          </Card>
        </section>

        <section id="suppressions" className="scroll-mt-32"><Card title="Suppression list"><SuppressionManager rows={suppressions ?? []} /></Card></section>

        <section id="exports" className="scroll-mt-32">
          <Card title="Exports">
            <div className="flex flex-wrap gap-2">
              <a href="/admin/marketing/settings/export?kind=contacts" className={buttonClass('secondary', 'sm')} download><Download className="size-4" aria-hidden="true" /> Download contacts CSV</a>
              <a href="/admin/marketing/settings/export?kind=consent" className={buttonClass('secondary', 'sm')} download><Download className="size-4" aria-hidden="true" /> Download consent ledger CSV</a>
            </div>
            <p className="mt-2 text-xs text-steel">Use for data requests and audits. Keep files private.</p>
          </Card>
        </section>

        <section id="channels" className="scroll-mt-32">
          <Card title="Channels">
            <ul className="grid gap-2 sm:grid-cols-2">
              <li className="flex items-center justify-between gap-2 rounded-sm border border-line bg-carbon px-3 py-2 text-sm">
                Text messages <Badge tone={smsLive ? 'good' : 'warn'}>{smsLive ? 'Live' : 'Simulated'}</Badge>
              </li>
              <li className="flex items-center justify-between gap-2 rounded-sm border border-line bg-carbon px-3 py-2 text-sm">
                Email <Badge tone={demoInbox ? 'warn' : 'good'}>{demoInbox ? 'Demo inbox' : 'Live'}</Badge>
              </li>
              {(connections ?? []).map((c) => (
                <li key={c.platform} className="flex items-center justify-between gap-2 rounded-sm border border-line bg-carbon px-3 py-2 text-sm">
                  <span className="capitalize">{c.platform.replace(/_/g, ' ')}{c.account_name ? ` · ${c.account_name}` : ''}</span>
                  <Badge tone={CHANNEL_TONE[c.status as keyof typeof CHANNEL_TONE] ?? 'neutral'}>{c.status.replace('_', ' ')}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </>
  );
}
