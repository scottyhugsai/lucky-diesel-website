import { Sparkles } from 'lucide-react';
import { Badge, Card, PageHeader } from '@/components/app/ui';
import { SectionTabs } from '@/components/admin/marketing/studio/Bits';
import { ConnectionCard } from '@/components/admin/marketing/studio/ConnectionCard';
import { CONTENT_TABS } from '@/components/admin/marketing/studio/labels';
import { requireRole } from '@/lib/auth';
import { resolveAiMode } from '@/lib/marketing/content/ai';
import { listConnections, liveAllowed } from '@/lib/marketing/content/channels/registry';
import { hasTokenKey } from '@/lib/marketing/content/crypto';
import { adminDb } from '@/lib/marketing/content/db';
import { connectPlatform, setMode } from './actions';

export const metadata = { title: 'Connections | Lucky Diesel admin' };

const ADS = ['meta_ads', 'google_ads', 'tiktok_ads', 'lsa'];

/** "••••1234": enough to recognise an account, never a token. */
function mask(accountId: string | null): string | null {
  if (!accountId) return null;
  return `ID ••••${accountId.slice(-4)}`;
}

export default async function ConnectionsPage() {
  await requireRole('admin');
  const [connections, { data: ids }] = await Promise.all([
    listConnections(),
    // Only the account id is read for a masked hint; token columns are never selected.
    adminDb().from('channel_connections').select('platform, external_account_id'),
  ]);
  const hints = new Map((ids ?? []).map((r) => [r.platform, mask(r.external_account_id)]));
  const ai = resolveAiMode();
  const keyReady = hasTokenKey();
  const ads = connections.filter((c) => ADS.includes(c.platform));
  const social = connections.filter((c) => !ADS.includes(c.platform));
  const card = (c: (typeof connections)[number]) => <ConnectionCard key={c.platform} connection={c} hint={hints.get(c.platform) ?? null} connect={connectPlatform} setMode={setMode} />;

  return (
    <>
      <PageHeader kicker="Marketing · Content" title="Connections" description="Link ad and social accounts. Demo until then." />
      <SectionTabs tabs={CONTENT_TABS} active="/admin/marketing/content/connections" />

      <div className="mb-6 flex flex-wrap gap-2">
        <Badge tone={keyReady ? 'good' : 'warn'}>{keyReady ? 'Token encryption ready' : 'MARKETING_TOKEN_KEY missing'}</Badge>
        <Badge tone={liveAllowed() ? 'good' : 'info'}>{liveAllowed() ? 'Live calls allowed' : 'Live calls off outside production'}</Badge>
      </div>

      <Card title={<span className="inline-flex items-center gap-2"><Sparkles className="size-5 text-violet-300" aria-hidden="true" />AI writer</span>} action={<Badge tone={ai.live ? 'good' : 'info'}>{ai.live ? 'Live AI' : 'Demo copy'}</Badge>} className="mb-8">
        {ai.live ? (
          <p className="text-sm text-chalk/75">Real AI is on. Model: {ai.model}. Every draft still goes through compliance and approval.</p>
        ) : (
          <>
            <p className="text-sm text-chalk/75">Ads and captions use templates now. Reason: {ai.reason}.</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-chalk/75">
              <li>Add a credit card to the Vercel team (AI Gateway), or get an AI Gateway key.</li>
              <li>Set <code className="rounded-sm bg-gunmetal px-1">AI_GATEWAY_API_KEY</code> if not deploying on Vercel.</li>
              <li>Set <code className="rounded-sm bg-gunmetal px-1">MARKETING_AI_MODE=live</code> and redeploy.</li>
            </ol>
            <p className="mt-2 text-xs text-steel">Takes minutes. Set a spend budget in Vercel too.</p>
          </>
        )}
      </Card>

      <section aria-labelledby="conn-ads" className="mb-8">
        <h2 id="conn-ads" className="kicker mb-3">Ad accounts</h2>
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">{ads.map(card)}</ul>
      </section>
      <section aria-labelledby="conn-social">
        <h2 id="conn-social" className="kicker mb-3">Posting accounts</h2>
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">{social.map(card)}</ul>
      </section>
    </>
  );
}
