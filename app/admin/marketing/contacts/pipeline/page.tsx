import Link from 'next/link';
import { loadPipeline } from '@/components/admin/marketing/core-ui/contacts-data';
import { sourceLabel } from '@/components/admin/marketing/core-ui/labels';
import { StageMover } from '@/components/admin/marketing/core-ui/StageMover';
import { Card, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { money, relativeTime } from '@/lib/format';
import { sweepSoon } from '@/lib/marketing/core/crm-sweep';
import { isPipelineId, PIPELINES, DEFAULT_PIPELINE, type PipelineId } from '@/lib/marketing/core/pipelines';

export const metadata = { title: 'Pipeline | Marketing' };

function scoreTone(score: number): string {
  if (score >= 70) return 'bg-clover text-carbon';
  if (score >= 40) return 'bg-amber-300 text-carbon';
  return 'bg-gunmetal text-chalk/70';
}

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ p?: string | string[] }> }) {
  await requireRole('admin');
  const raw = (await searchParams).p;
  const chosen = Array.isArray(raw) ? raw[0] : raw;
  const pipeline: PipelineId = isPipelineId(chosen) ? chosen : DEFAULT_PIPELINE;
  await sweepSoon();
  const { stages, cards, report } = await loadPipeline(pipeline);
  const columns = [
    ...(cards.some((c) => !c.stageId || !stages.find((s) => s.id === c.stageId)) ? [{ id: 'none', name: 'Unstaged', weight: 0, isWon: false, isLost: false, key: 'none' }] : []),
    ...stages,
  ];
  const moverStages = stages.map((s) => ({ id: s.id, name: s.name, isLost: s.isLost }));

  return (
    <>
      <PageHeader
        kicker="Contacts"
        title="Lead pipeline"
        description="Hottest leads first. Move a card when things change."
        actions={
          <div role="group" aria-label="Pipeline" className="inline-flex rounded-sm border border-line bg-carbon p-0.5">
            {PIPELINES.map((option) => (
              <Link
                key={option.id}
                href={option.id === DEFAULT_PIPELINE ? '/admin/marketing/contacts/pipeline' : `/admin/marketing/contacts/pipeline?p=${option.id}`}
                aria-current={pipeline === option.id ? 'true' : undefined}
                className={`inline-flex h-8 items-center rounded-sm px-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                  pipeline === option.id ? 'bg-clover text-carbon' : 'text-steel hover:text-chalk'
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        }
      />
      <div className="relative -mx-4 w-0 min-w-[calc(100%+2rem)] overflow-x-auto px-4 pb-4 sm:-mx-6 sm:min-w-[calc(100%+3rem)] sm:px-6 lg:mx-0 lg:min-w-full lg:px-0">
        <ol className="flex w-max gap-3">
          {columns.map((stage) => {
            const items = cards.filter((c) => (stage.id === 'none' ? !c.stageId || !stages.find((s) => s.id === c.stageId) : c.stageId === stage.id));
            return (
              <li key={stage.id} className={`flex w-[17rem] shrink-0 flex-col rounded-md border bg-carbon-2 ${stage.isWon ? 'border-clover/40' : stage.isLost ? 'border-danger/30' : 'border-line'}`}>
                <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
                  <h2 className="text-sm font-bold uppercase tracking-widest">{stage.name}</h2>
                  <span className="flex items-center gap-2 text-xs text-steel">
                    {stage.weight > 0 && <span title="Stage score weight">+{stage.weight}</span>}
                    <span className="grid min-w-6 place-items-center rounded-full bg-gunmetal px-1.5 py-0.5 font-bold tabular-nums text-chalk">{items.length}</span>
                  </span>
                </header>
                <ul className="grid max-h-[65vh] grid-cols-1 content-start gap-2 overflow-y-auto p-2">
                  {items.length === 0 && <li className="px-2 py-6 text-center text-xs text-steel">Empty</li>}
                  {items.map((card) => (
                    <li key={card.id} className="min-w-0 rounded-sm border border-line bg-carbon p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/admin/leads?focus=${card.id}`} className="min-w-0 font-semibold leading-tight hover:text-clover">{card.name}</Link>
                        <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-bold tabular-nums ${scoreTone(card.score)}`} title="Lead score">{card.score}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-chalk/60">{[card.platform, card.service].filter(Boolean).join(' · ') || 'No details'}</p>
                      <p className="mt-0.5 text-[0.7rem] text-steel">
                        {sourceLabel(card.source)} · {relativeTime(card.createdAt)}
                        {card.dealValueCents > 0 && <> · <span className="font-mono text-chalk/70">{money(card.dealValueCents, { whole: true })}</span></>}
                        {card.winChance !== null && <> · {Math.round(card.winChance * 100)}% likely</>}
                      </p>
                      <StageMover leadId={card.id} currentStageId={card.stageId} stages={moverStages} />
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>

      <section aria-labelledby="win-loss" className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card title="Win / loss">
          <h2 id="win-loss" className="sr-only">Win and loss</h2>
          <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Won', String(report.won)],
              ['Lost', String(report.lost)],
              ['Win rate', report.winRate === null ? '—' : `${Math.round(report.winRate * 100)}%`],
              ['Won value', money(report.wonValueCents, { whole: true })],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[0.65rem] font-semibold uppercase tracking-widest text-steel">{label}</dt>
                <dd className="display text-2xl not-italic tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-steel">
            {report.medianFirstResponseMinutes === null ? 'No first replies recorded yet.' : `Median first reply ${report.medianFirstResponseMinutes} min.`}
            {report.openValueCents > 0 && ` Open value ${money(report.openValueCents, { whole: true })}.`}
          </p>
          {report.lostReasons.length > 0 && (
            <ul className="mt-3 grid gap-1 text-sm">
              {report.lostReasons.slice(0, 5).map((row) => (
                <li key={row.label} className="flex justify-between gap-3"><span>{row.label}</span><span className="font-mono tabular-nums text-steel">{row.count}</span></li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="By source">
          <ul className="grid gap-1.5 text-sm">
            {report.bySource.slice(0, 8).map((row) => (
              <li key={row.label} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-semibold">{row.label}</span>
                <span className="font-mono tabular-nums text-chalk/70">
                  {row.won}W / {row.lost}L{row.winRate !== null && <span className="text-steel"> · {Math.round(row.winRate * 100)}%</span>}
                </span>
              </li>
            ))}
            {report.bySource.length === 0 && <li className="text-steel">No outcomes yet.</li>}
          </ul>
        </Card>
      </section>
    </>
  );
}
