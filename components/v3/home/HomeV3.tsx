import { Fragment, Suspense } from 'react';
import { ReviewStrip } from '@/components/marketing-public/ReviewStrip';
import { QuoteSection, QuoteSectionFromUrl } from '@/components/quote/QuoteSection';
import type { SiteContent } from '@/lib/site-content/read';
import { getBuildStats, getNextOpenSlot } from '../data';
import { FeaturedPartsV3 } from './FeaturedPartsV3';
import { HeroV3 } from './HeroV3';
import { LeaderboardV3 } from './LeaderboardV3';
import { PlannerBandV3 } from './PlannerBandV3';
import { ProofStripV3 } from './ProofStripV3';
import { ReviewsV3 } from './ReviewsV3';
import { ServicesV3 } from './ServicesV3';

/** Design v3 "Telemetry" home. Server component; counters and the shell are the only client code. */
export async function HomeV3({ order, content }: { order: readonly string[]; content: SiteContent }) {
  const [stats, nextSlot] = await Promise.all([getBuildStats(), getNextOpenSlot()]);
  const quote = content.block('home.quote');
  const sections: Record<string, React.ReactNode> = {
    hero: <HeroV3 stats={stats} nextSlot={nextSlot} values={content.block('home.hero')} />,
    platforms: <ProofStripV3 stats={stats} />,
    services: <ServicesV3 values={content.block('home.services')} />,
    builds: <LeaderboardV3 stats={stats} />,
    parts: <FeaturedPartsV3 values={content.block('home.parts')} />,
    process: <PlannerBandV3 />,
    // Real reviews replace the honest placeholder only once they exist.
    reviews: <ReviewStrip fallback={<ReviewsV3 />} />,
    quote: (
      <Suspense fallback={<QuoteSection values={quote} />}>
        <QuoteSectionFromUrl values={quote} />
      </Suspense>
    ),
  };
  return <>{order.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}</>;
}
