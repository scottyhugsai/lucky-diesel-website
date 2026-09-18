import { Fragment, Suspense } from 'react';
import { ReviewStrip } from '@/components/marketing-public/ReviewStrip';
import { QuoteSection, QuoteSectionFromUrl } from '@/components/quote/QuoteSection';
import { getBuildStats, getNextOpenSlot } from '@/components/v3/data';
import type { SiteContent } from '@/lib/site-content/read';
import { BoardV4 } from './BoardV4';
import { HeroV4 } from './HeroV4';
import { LineupV4 } from './LineupV4';
import { PartsV4 } from './PartsV4';
import { ProcessV4 } from './ProcessV4';
import { ServicesV4 } from './ServicesV4';

/** Design v4 "Vector" home. Server component; only the header and the hero's
 *  canvas run on the client. */
export async function HomeV4({ order, content }: { order: readonly string[]; content: SiteContent }) {
  const [stats, nextSlot] = await Promise.all([getBuildStats(), getNextOpenSlot()]);
  const quote = content.block('home.quote');

  const sections: Record<string, React.ReactNode> = {
    hero: <HeroV4 values={content.block('home.hero')} stats={stats} nextSlot={nextSlot} />,
    platforms: <LineupV4 />,
    services: <ServicesV4 values={content.block('home.services')} />,
    builds: <BoardV4 stats={stats} />,
    parts: <PartsV4 values={content.block('home.parts')} />,
    process: <ProcessV4 />,
    reviews: <ReviewStrip />,
    quote: (
      <Suspense fallback={<QuoteSection values={quote} />}>
        <QuoteSectionFromUrl values={quote} />
      </Suspense>
    ),
  };
  return <>{order.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}</>;
}
