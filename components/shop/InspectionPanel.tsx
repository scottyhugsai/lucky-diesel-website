import { CircleCheck } from 'lucide-react';
import type { JobData } from '@/app/shop/jobs/[id]/_data';
import { Badge } from '@/components/app/ui';
import { dateTime } from '@/lib/format';
import { AddItemForm } from './AddItemForm';
import { InspectionItemCard, type ItemLine } from './InspectionItemCard';
import type { MediaThumb } from './MediaThumbs';
import { SendInspectionForm, StartInspectionButton } from './SendInspectionForm';

interface InspectionPanelProps {
  data: JobData;
  customerFirstName: string;
}

function suggestSummary(items: { label: string; rating: string }[]): string {
  const red = items.filter((item) => item.rating === 'red').map((item) => item.label.toLowerCase());
  const yellow = items.filter((item) => item.rating === 'yellow').map((item) => item.label.toLowerCase());
  const parts = [
    red.length ? `Needs attention now: ${red.join(', ')}.` : '',
    yellow.length ? `Keep an eye on: ${yellow.join(', ')}.` : '',
  ].filter(Boolean);
  return parts.length ? `We went over the truck top to bottom. ${parts.join(' ')} Photos and prices are below.` : 'We went over the truck top to bottom and everything checked out. Photos are below.';
}

export function InspectionPanel({ data, customerFirstName }: InspectionPanelProps) {
  const { job, inspection, lines, media, laborRateCents, approval } = data;
  if (!inspection) return <StartInspectionButton workOrderId={job.id} />;

  const draft = inspection.status === 'draft';
  const recommended = lines.filter((line) => line.recommended);
  const tally = {
    approved: recommended.filter((line) => line.approval === 'approved').length,
    declined: recommended.filter((line) => line.approval === 'declined').length,
    pending: recommended.filter((line) => line.approval === 'pending').length,
  };
  const countOf = (rating: string) => inspection.items.filter((item) => item.rating === rating).length;
  const counts = { red: countOf('red'), yellow: countOf('yellow'), green: countOf('green') };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="bad">{counts.red} red</Badge>
        <Badge tone="warn">{counts.yellow} yellow</Badge>
        <Badge tone="good">{counts.green} green</Badge>
        <span className="text-steel">· {inspection.items.length} item{inspection.items.length === 1 ? '' : 's'}</span>
      </div>

      {!draft && (
        <div role="status" className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-md border border-violet/40 bg-violet/10 p-4">
          <p className="flex items-center gap-2 font-semibold text-chalk">
            <CircleCheck className="size-5 text-clover" aria-hidden="true" />
            Sent to {customerFirstName || 'customer'}{inspection.sent_at ? ` · ${dateTime(inspection.sent_at)}` : ''}
          </p>
          {inspection.summary && <p className="text-sm text-chalk/75">“{inspection.summary}”</p>}
          <div className="flex flex-wrap gap-2">
            <Badge tone="good">{tally.approved} approved</Badge>
            <Badge tone="bad">{tally.declined} declined</Badge>
            <Badge tone="neutral">{tally.pending} waiting</Badge>
          </div>
          <p className="text-sm text-chalk/60">
            {approval ? `Signed by ${approval.signer_name} · ${dateTime(approval.created_at)}` : 'No response yet — the customer gets a nudge if they sit on it.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
        {inspection.items.map((item) => {
          const itemMedia: MediaThumb[] = media.filter((row) => row.inspection_item_id === item.id);
          const itemLines: ItemLine[] = lines
            .filter((line) => line.inspection_item_id === item.id)
            .map((line) => ({ id: line.id, kind: line.kind, description: line.description, quantity: Number(line.quantity), unitPriceCents: line.unit_price_cents, approval: line.approval }));
          return (
            <InspectionItemCard key={item.id} workOrderId={job.id} item={item} media={itemMedia} lines={itemLines} draft={draft} laborRateCents={laborRateCents} />
          );
        })}
      </div>

      {draft && (
        <>
          <AddItemForm workOrderId={job.id} />
          <SendInspectionForm
            key={suggestSummary(inspection.items)}
            workOrderId={job.id}
            customerFirstName={customerFirstName}
            suggestedSummary={suggestSummary(inspection.items)}
            itemCount={inspection.items.length}
            movesToApproval={job.status === 'estimate'}
          />
        </>
      )}
    </div>
  );
}
