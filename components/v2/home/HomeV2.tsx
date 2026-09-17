import { Suspense } from 'react';
import { ReviewStrip } from '@/components/marketing-public/ReviewStrip';
import { QuoteSection, QuoteSectionFromUrl } from '@/components/quote/QuoteSection';
import { BentoV2 } from './BentoV2';
import { CtaBandV2 } from './CtaBandV2';
import { FeaturedPartsV2 } from './FeaturedPartsV2';
import { HeroV2 } from './HeroV2';
import { LineupV2 } from './LineupV2';
import { ServicesV2 } from './ServicesV2';
import { SubNavV2 } from './SubNavV2';

/** Design v2 "Showroom" home. Server component; only the header and Reveal wrappers run on the client. */
export function HomeV2() {
  return (
    <>
      <HeroV2 />
      <SubNavV2 />
      <LineupV2 />
      <BentoV2 />
      <FeaturedPartsV2 />
      <ServicesV2 />
      <ReviewStrip />
      <CtaBandV2 />
      <Suspense fallback={<QuoteSection />}>
        <QuoteSectionFromUrl />
      </Suspense>
    </>
  );
}
