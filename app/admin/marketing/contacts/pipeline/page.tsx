import Link from 'next/link';
import { loadPipeline } from '@/components/admin/marketing/core-ui/contacts-data';
import { sourceLabel } from '@/components/admin/marketing/core-ui/labels';
import { StageMover } from '@/components/admin/marketing/core-ui/StageMover';
import { PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { relativeTime } from '@/lib/format';

export const metadata = { title: 'Pipeline | Marketing' };

function scoreTone(score: number): string {
  if (score >= 70) return 'bg-clover text-carbon';
  if (score >= 40) return 'bg-amber-300 text-carbon';
  return 'bg-gunmetal text-chalk/70';
}

export default async function PipelinePage() {
  await requireRole('admin');
  const { stages, cards } = await loadPipeline();
  const columns = [
    ...(cards.some((c) => !c.stageId || !stages.find((s) => s.id === c.stageId)) ? [{ id: 'none', name: 'Unstaged', weight: 0, isWon: false, isLost: false, key: 'none' }] : []),
    ...stages,
  ];
  const moverStages = stages.map((s) => ({ id: s.id, name: s.name, isLost: s.isLost }));

  return (
    <>
      <PageHeader kicker="Contacts" title="Lead pipeline" description="Hottest leads first. Move a card when things change." />
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
                      <p className="mt-0.5 text-[0.7rem] text-steel">{sourceLabel(card.source)} · {relativeTime(card.createdAt)}</p>
                      <StageMover leadId={card.id} currentStageId={card.stageId} stages={moverStages} />
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
