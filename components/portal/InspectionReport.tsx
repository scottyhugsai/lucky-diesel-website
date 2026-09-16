import { dateTime } from '@/lib/format';
import { InspectionItemCard, RATING, type InspectionGroup } from './InspectionItemCard';
import { LineSummary } from './LineSummary';

interface InspectionReportProps {
  summary: string | null;
  sentAt: string | null;
  techName: string | null;
  groups: InspectionGroup[];
}

export function InspectionSummary({ summary, sentAt, techName, groups }: InspectionReportProps) {
  const items = groups.flatMap((group) => group.items);
  const counts = (['red', 'yellow', 'green'] as const).map((rating) => ({ rating, count: items.filter((item) => item.rating === rating).length }));
  return (
    <div>
      <p className="text-sm text-steel">
        Digital inspection{techName ? ` by ${techName}` : ''}{sentAt ? ` · ${dateTime(sentAt)}` : ''}
      </p>
      {summary && <p className="mt-2 text-lg leading-relaxed text-chalk/85">{summary}</p>}
      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Inspection results">
        {counts.map(({ rating, count }) => (
          <li key={rating} className="flex items-center gap-2 rounded-sm border border-line bg-carbon px-3 py-1.5 text-sm">
            <span className={`size-2 rounded-full ${RATING[rating].dot}`} aria-hidden="true" />
            <span className="font-semibold tabular-nums">{count}</span>
            <span className="text-chalk/65">{RATING[rating].label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Static inspection report (after the estimate has been answered). */
export function InspectionReport(props: InspectionReportProps) {
  return (
    <section aria-labelledby="inspection" className="rounded-md border border-line bg-carbon-2 p-4 sm:p-6">
      <p id="inspection" className="kicker">Inspection report</p>
      <div className="mt-2">
        <InspectionSummary {...props} />
      </div>
      <div className="mt-6 space-y-6">
        {props.groups.map((group) => (
          <div key={group.category}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-steel">{group.category}</h3>
            <div className="space-y-3">
              {group.items.map((item) => (
                <InspectionItemCard key={item.id} item={item}>
                  {item.lines.length > 0 && (
                    <div className="divide-y divide-line">
                      {item.lines.map((line) => <LineSummary key={line.id} line={line} />)}
                    </div>
                  )}
                </InspectionItemCard>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
