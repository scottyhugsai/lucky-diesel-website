import { Archive, CalendarClock, Pause, Play, Send } from 'lucide-react';
import { archiveAction, pauseAction, resumeAction, saveAudienceAction, scheduleAction } from '@/app/admin/marketing/campaigns/actions';
import { testSendAction } from '@/app/admin/marketing/campaigns/draft-actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { toShopInputValue } from '@/components/admin/core/parse';
import { Card, fieldClass, labelClass } from '@/components/app/ui';
import type { Tables } from '@/lib/db/database.types';

type Campaign = Tables<'campaigns'>;

/** Primary actions for a campaign, chosen by its status. */
export function CampaignControls({ campaign, defaultSendAt }: { campaign: Campaign; defaultSendAt: string }) {
  const { id, status, kind } = campaign;
  const live = ['scheduled', 'sending', 'active'].includes(status);
  const canSchedule = ['draft', 'paused', 'scheduled'].includes(status);

  return (
    <Card title="Send">
      <div className="grid gap-4">
        {canSchedule && status !== 'paused' && (
          <ActionForm action={scheduleAction} className="grid gap-2">
            <input type="hidden" name="id" value={id} />
            {kind === 'broadcast' ? (
              <label><span className={labelClass}>Send at (shop time)</span>
                <input type="datetime-local" name="scheduled_at" required defaultValue={campaign.scheduled_at ? toShopInputValue(campaign.scheduled_at) : defaultSendAt} className={fieldClass} />
              </label>
            ) : (
              <p className="text-sm text-chalk/65">Goes live now. People enroll on the trigger.</p>
            )}
            <PendingButton className="justify-self-start">
              {kind === 'broadcast' ? <CalendarClock className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
              {status === 'scheduled' ? 'Reschedule' : kind === 'broadcast' ? 'Schedule send' : 'Start campaign'}
            </PendingButton>
          </ActionForm>
        )}

        <div className="flex flex-wrap gap-2">
          {live && (
            <ActionForm action={pauseAction}>
              <input type="hidden" name="id" value={id} />
              <PendingButton variant="secondary" size="sm"><Pause className="size-4" aria-hidden="true" /> Pause</PendingButton>
            </ActionForm>
          )}
          {status === 'paused' && (
            <ActionForm action={resumeAction}>
              <input type="hidden" name="id" value={id} />
              <PendingButton size="sm"><Play className="size-4" aria-hidden="true" /> Resume</PendingButton>
            </ActionForm>
          )}
          <ActionForm action={testSendAction}>
            <input type="hidden" name="id" value={id} />
            <PendingButton variant="secondary" size="sm"><Send className="size-4" aria-hidden="true" /> Send test to me</PendingButton>
          </ActionForm>
          {['draft', 'paused', 'sent'].includes(status) && (
            <ActionForm action={archiveAction} confirm="Archive this campaign?">
              <input type="hidden" name="id" value={id} />
              <PendingButton variant="ghost" size="sm"><Archive className="size-4" aria-hidden="true" /> Archive</PendingButton>
            </ActionForm>
          )}
        </div>
      </div>
    </Card>
  );
}

export function AudienceForm({ campaign, segments }: { campaign: Campaign; segments: { id: string; name: string; member_count: number }[] }) {
  const editable = ['draft', 'paused'].includes(campaign.status);
  return (
    <Card title="Name and audience">
      <ActionForm action={saveAudienceAction} className="grid gap-3">
        <input type="hidden" name="id" value={campaign.id} />
        <label><span className={labelClass}>Name</span>
          <input name="name" defaultValue={campaign.name} maxLength={120} required disabled={!editable} className={fieldClass} />
        </label>
        <label><span className={labelClass}>Segment</span>
          <select name="segment_id" defaultValue={campaign.segment_id ?? ''} disabled={!editable} className={fieldClass}>
            <option value="">{campaign.kind === 'broadcast' ? 'Pick a segment' : 'None (trigger only)'}</option>
            {segments.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.member_count}</option>)}
          </select>
        </label>
        {editable ? <PendingButton variant="secondary" size="sm" className="justify-self-start">Save</PendingButton> : <p className="text-xs text-steel">Pause to change.</p>}
      </ActionForm>
    </Card>
  );
}
