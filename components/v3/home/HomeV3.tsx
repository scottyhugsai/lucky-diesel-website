import { Suspense } from 'react';
import { QuoteSection, QuoteSectionFromUrl } from '@/components/quote/QuoteSection';
import { getBuildStats, getNextOpenSlot } from '../data';
import { FeaturedPartsV3 } from './FeaturedPartsV3';
import { HeroV3 } from './HeroV3';
import { LeaderboardV3 } from './LeaderboardV3';
import { PlannerBandV3 } from './PlannerBandV3';
import { ProofStripV3 } from './ProofStripV3';
import { ReviewsV3 } from './ReviewsV3';
import { ServicesV3 } from './ServicesV3';

/** Design v3 "Telemetry" home, in the spec's section order. Server component; counters and the shell are the only client code. */
export async function HomeV3() {
  const [stats, nextSlot] = await Promise.all([getBuildStats(), getNextOpenSlot()]);
  return (
    <>
      <HeroV3 stats={stats} nextSlot={nextSlot} />
      <ProofStripV3 stats={stats} />
      <PlannerBandV3 />
      <ServicesV3 />
      <LeaderboardV3 stats={stats} />
      <FeaturedPartsV3 />
      <ReviewsV3 />
      <Suspense fallback={<QuoteSection />}>
        <QuoteSectionFromUrl />
      </Suspense>
    </>
  );
}
