import { FileSignature, ShieldCheck } from 'lucide-react';
import type { Tables } from '@/lib/db/database.types';
import { dateTime, money } from '@/lib/format';

/** The e-signed estimate, as stored. */
export function ApprovalRecord({ approval }: { approval: Tables<'approvals'> }) {
  const approvedCount = approval.approved_item_ids.length;
  const declinedCount = approval.declined_item_ids.length;
  return (
    <section aria-label="Signed estimate" className="flex flex-col gap-4 rounded-md border border-clover/35 bg-clover/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 size-6 shrink-0 text-clover" aria-hidden="true" />
        <div>
          <p className="kicker">Estimate signed</p>
          <p className="display mt-1 text-3xl not-italic">{approval.signer_name}</p>
          <p className="mt-1 text-sm text-chalk/70">
            {dateTime(approval.created_at)} · {approvedCount} approved{declinedCount ? `, ${declinedCount} declined` : ''}
          </p>
          <p className="mt-1 break-all font-mono text-[0.7rem] text-steel" title="SHA-256 of the signed snapshot">
            SHA-256 {approval.snapshot_sha256.slice(0, 16)}…
          </p>
        </div>
      </div>
      <div className="sm:text-right">
        <p className="text-xs font-semibold uppercase tracking-widest text-steel">Approved total</p>
        <p className="display text-4xl not-italic tabular-nums text-clover">{money(approval.approved_total_cents)}</p>
      </div>
    </section>
  );
}

export function AcknowledgementRecord({ acknowledgement }: { acknowledgement: Tables<'acknowledgements'> }) {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 font-semibold text-clover">
        <FileSignature className="size-5" aria-hidden="true" />
        Signed by {acknowledgement.signer_name} on {dateTime(acknowledgement.created_at)}
      </p>
      <details className="group rounded-sm border border-line bg-carbon">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-chalk/80 hover:text-chalk">
          View signed text (version {acknowledgement.template_version})
        </summary>
        <p className="whitespace-pre-line border-t border-line p-4 text-sm leading-relaxed text-chalk/75">{acknowledgement.body}</p>
      </details>
    </div>
  );
}
