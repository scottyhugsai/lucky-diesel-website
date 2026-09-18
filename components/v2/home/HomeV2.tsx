import { Fragment, Suspense } from 'react';
import { ReviewStrip } from '@/components/marketing-public/ReviewStrip';
import { QuoteSection, QuoteSectionFromUrl } from '@/components/quote/QuoteSection';
import type { SiteContent } from '@/lib/site-content/read';
import { BentoV2 } from './BentoV2';
import { CtaBandV2 } from './CtaBandV2';
import { FeaturedPartsV2 } from './FeaturedPartsV2';
import { HeroV2 } from './HeroV2';
import { LineupV2 } from './LineupV2';
import { ServicesV2 } from './ServicesV2';
import { SubNavV2 } from './SubNavV2';

/** Design v2 "Showroom" home. Server component; only the header and Reveal wrappers run on the client. */
export function HomeV2({ order, content }: { order: readonly string[]; content: SiteContent }) {
  const quote = content.block('home.quote');
  const sections: Record<string, React.ReactNode> = {
    // The sub-nav belongs to the hero, so it travels with it.
    hero: <><HeroV2 values={content.block('home.hero')} /><SubNavV2 /></>,
    platforms: <LineupV2 />,
    services: <ServicesV2 values={content.block('home.services')} />,
    builds: <BentoV2 />,
    parts: <FeaturedPartsV2 values={content.block('home.parts')} />,
    process: <CtaBandV2 />,
    reviews: <ReviewStrip />,
    quote: (
      <Suspense fallback={<QuoteSection values={quote} />}>
        <QuoteSectionFromUrl values={quote} />
      </Suspense>
    ),
  };
  return <>{order.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}</>;
}
