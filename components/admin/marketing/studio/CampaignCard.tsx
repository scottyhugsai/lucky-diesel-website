import Link from 'next/link';
import { Pause, Play, Send, Upload } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import type { ActionState } from '@/components/admin/core/parse';
import { Badge, ButtonLink, fieldClass } from '@/components/app/ui';
import { dateOnly, money } from '@/lib/format';
import type { CampaignPlatform } from '@/lib/marketing/content/types';
import { SimulatedBadge, StatusBadge } from './Bits';
import { CAMPAIGN_PLATFORM_LABEL } from './labels';

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export interface CampaignView {
  id: string;
  name: string;
  platform: CampaignPlatform;
  status: string;
  objective: string;
  dailyBudgetCents: number;
  startsOn: string | null;
  endsOn: string | null;
  simulated: boolean;
  notes: string | null;
  radiusMiles: number | null;
  targeting: string | null;
  publications: number;
}

export interface CampaignActions {
  publish: Action;
  activate: Action;
  pause: Action;
  resubmit: Action;
}

const CAN_PUBLISH = ['approved', 'scheduled', 'paused'];

/** One campaign with the next step it needs: approve → attach ads → activate / pause. */
export function CampaignCard({ campaign, creatives, actions }: { campaign: CampaignView; creatives: readonly { id: string; name: string }[]; actions: CampaignActions }) {
  const id = <input type="hidden" name="campaignId" value={campaign.id} />;
  const dates = campaign.startsOn && campaign.endsOn ? `${dateOnly(`${campaign.startsOn}T12:00:00`)} – ${dateOnly(`${campaign.endsOn}T12:00:00`)}` : 'No dates';

  return (
    <li className="rounded-md border border-line bg-carbon-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{campaign.name}</p>
          <p className="text-sm text-chalk/60">{CAMPAIGN_PLATFORM_LABEL[campaign.platform]} · {campaign.objective} · {campaign.targeting ?? `${campaign.radiusMiles ?? 30} mi`}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={campaign.status} />
          {campaign.simulated && <SimulatedBadge />}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-xs uppercase tracking-widest text-steel">Per day</dt><dd className="font-semibold tabular-nums">{money(campaign.dailyBudgetCents)}</dd></div>
        <div className="col-span-2"><dt className="text-xs uppercase tracking-widest text-steel">Dates</dt><dd>{dates}</dd></div>
      </dl>
      <p className="mt-2 text-sm text-chalk/60">{campaign.publications ? `${campaign.publications} ad variants attached` : 'No ads attached yet'}</p>
      {campaign.notes?.startsWith('Paused:') && <p className="mt-1 text-sm text-amber-300">{campaign.notes}</p>}

      <div className="mt-3 grid gap-2 border-t border-line pt-3">
        {campaign.status === 'pending_approval' && <ButtonLink href="/admin/marketing/ads/approvals" size="sm" variant="secondary">Approve it first</ButtonLink>}
        {['rejected', 'draft'].includes(campaign.status) && (
          <ActionForm action={actions.resubmit}>{id}<PendingButton size="sm" variant="secondary"><Send className="size-4" aria-hidden="true" />Send for approval</PendingButton></ActionForm>
        )}
        {CAN_PUBLISH.includes(campaign.status) && (
          creatives.length ? (
            <ActionForm action={actions.publish} className="flex flex-wrap gap-2">
              {id}
              <select name="creativeId" aria-label="Approved ad to attach" className={`${fieldClass} h-9 min-w-0 flex-1 basis-48 text-sm`}>
                {creatives.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <PendingButton size="sm" variant="secondary"><Upload className="size-4" aria-hidden="true" />Attach + publish</PendingButton>
            </ActionForm>
          ) : (
            <p className="text-sm text-chalk/55">No approved {CAMPAIGN_PLATFORM_LABEL[campaign.platform]} ads. <Link className="text-clover underline" href="/admin/marketing/ads">Make one</Link>.</p>
          )
        )}
        <div className="flex flex-wrap gap-2">
          {['scheduled', 'paused'].includes(campaign.status) && campaign.publications > 0 && (
            <ActionForm action={actions.activate} confirm={`Start spending up to ${money(campaign.dailyBudgetCents)}/day?`}>{id}<PendingButton size="sm"><Play className="size-4" aria-hidden="true" />Activate</PendingButton></ActionForm>
          )}
          {campaign.status === 'live' && (
            <ActionForm action={actions.pause}>{id}<PendingButton size="sm" variant="danger"><Pause className="size-4" aria-hidden="true" />Pause</PendingButton></ActionForm>
          )}
          {campaign.status === 'live' && <Badge tone="good">Spending</Badge>}
        </div>
      </div>
    </li>
  );
}
