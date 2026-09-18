import { Fragment, Suspense } from 'react';
import { ReviewStrip } from '@/components/marketing-public/ReviewStrip';
import { QuoteSection, QuoteSectionFromUrl } from '@/components/quote/QuoteSection';
import { getBuildStats } from '@/components/v3/data';
import type { Fitment } from '@/lib/fitment/select';
import type { SiteContent } from '@/lib/site-content/read';
import { BoardV4 } from './BoardV4';
import { GoalsV4 } from './GoalsV4';
import { HeroV4 } from './HeroV4';
import { PartsV4 } from './PartsV4';
import { PlatformsV4 } from './PlatformsV4';
import { ProcessV4 } from './ProcessV4';

const NUMBERED = new Set(['platforms', 'services', 'parts', 'builds', 'process']);

/** Design v4 "Fitment" home. Server-rendered throughout; the only client code
 *  is the header and the picker's auto-submit. */
export async function HomeV4({ order, content, fitment }: { order: readonly string[]; content: SiteContent; fitment: Fitment }) {
  const stats = await getBuildStats();
  const quote = content.block('home.quote');

  // The owner controls the section order, so the "01 —" labels are numbered
  // from where each section actually lands rather than hardcoded.
  const numbered = order.filter((id) => NUMBERED.has(id));
  const step = (id: string) => String(numbered.indexOf(id) + 1).padStart(2, '0');

  const sections: Record<string, React.ReactNode> = {
    hero: <HeroV4 values={content.block('home.hero')} fitment={fitment} stats={stats} />,
    platforms: <PlatformsV4 step={step('platforms')} />,
    services: <GoalsV4 values={content.block('home.services')} step={step('services')} />,
    parts: <PartsV4 values={content.block('home.parts')} step={step('parts')} />,
    builds: <BoardV4 stats={stats} step={step('builds')} />,
    process: <ProcessV4 step={step('process')} />,
    reviews: <ReviewStrip />,
    quote: (
      <Suspense fallback={<QuoteSection values={quote} />}>
        <QuoteSectionFromUrl values={quote} />
      </Suspense>
    ),
  };
  return <>{order.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}</>;
}
