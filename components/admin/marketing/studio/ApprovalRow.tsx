import Link from 'next/link';
import { Check, MessageSquareWarning, X } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import type { ActionState } from '@/components/admin/core/parse';
import { Badge, fieldClass } from '@/components/app/ui';
import { relativeTime } from '@/lib/format';
import type { ComplianceStatus } from '@/lib/marketing/content/types';
import { ComplianceBadge } from './Bits';
import { creativeImage } from './labels';

export interface QueueItem {
  id: string;
  subjectType: string;
  subjectId: string;
  title: string;
  compliance: ComplianceStatus;
  requestedAt: string;
  stale: boolean;
  privacy: boolean;
  hasImage: boolean;
}

const KIND: Record<string, { label: string; href: (id: string) => string }> = {
  ad_creative: { label: 'Ad', href: (id) => `/admin/marketing/ads/creative/${id}` },
  ad_campaign: { label: 'Campaign', href: () => '/admin/marketing/ads/campaigns' },
  social_post: { label: 'Post', href: (id) => `/admin/marketing/social/${id}` },
  seo_content: { label: 'SEO page', href: (id) => `/admin/marketing/content/${id}` },
  review_reply: { label: 'Review reply', href: () => '/admin/marketing' },
  landing_page: { label: 'Landing page', href: () => '/admin/marketing' },
};

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** One queued item: preview, flags, and approve / request change / reject. */
export function ApprovalRow({ item, action }: { item: QueueItem; action: Action }) {
  const kind = KIND[item.subjectType] ?? { label: item.subjectType, href: () => '/admin/marketing' };
  const needsAck = item.compliance === 'warn' || item.privacy;
  const blocked = item.compliance === 'block';

  return (
    <li className="rounded-md border border-line bg-carbon-2 p-4">
      <div className="flex flex-wrap gap-4">
        {item.hasImage && (
          // eslint-disable-next-line @next/next/no-img-element -- PNG rendered on demand by our image route (drafts are auth-gated); next/image can't optimize it.
          <img src={creativeImage(item.subjectId, '1:1')} alt="" width={96} height={96} loading="lazy" className="size-24 shrink-0 rounded-sm border border-line bg-gunmetal object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="info">{kind.label}</Badge>
            <ComplianceBadge status={item.compliance} />
            {item.privacy && <Badge tone="warn">Check plates/faces</Badge>}
            {item.stale && <Badge tone="bad">Edited since sent</Badge>}
          </div>
          <Link href={kind.href(item.subjectId)} className="mt-1.5 block font-semibold hover:text-clover">{item.title}</Link>
          <p className="text-sm text-chalk/55">Sent {relativeTime(item.requestedAt)}</p>
        </div>
      </div>

      <ActionForm action={action} className="mt-3 grid gap-2 border-t border-line pt-3">
        <input type="hidden" name="approvalId" value={item.id} />
        {needsAck && !blocked && (
          <label className="flex items-start gap-2 text-sm text-chalk/85">
            <input type="checkbox" name="ack" className="mt-1 size-4" />
            <span>{item.privacy ? 'I checked plates, VINs, faces and wording.' : 'I checked the flagged wording.'}</span>
          </label>
        )}
        {blocked && <p className="text-sm text-danger">Blocked wording. Open it and fix before approving.</p>}
        {item.stale && <p className="text-sm text-danger">Content changed. It must be sent again.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <PendingButton size="sm" name="decision" value="approved" disabled={blocked || item.stale}>
            <Check className="size-4" aria-hidden="true" />Approve
          </PendingButton>
          <input name="notes" aria-label="Change request note" placeholder="What to change?" className={`${fieldClass} h-9 min-w-0 flex-1 basis-40 text-sm`} maxLength={500} />
          <PendingButton size="sm" variant="secondary" name="decision" value="changes_requested">
            <MessageSquareWarning className="size-4" aria-hidden="true" />Request change
          </PendingButton>
          <PendingButton size="sm" variant="danger" name="decision" value="rejected">
            <X className="size-4" aria-hidden="true" />Reject
          </PendingButton>
        </div>
      </ActionForm>
    </li>
  );
}
