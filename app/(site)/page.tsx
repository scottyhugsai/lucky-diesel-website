import { Fragment, Suspense } from 'react';
import { ReviewStrip } from '@/components/marketing-public/ReviewStrip';
import { QuoteSection, QuoteSectionFromUrl } from '@/components/quote/QuoteSection';
import { FeaturedBuild } from '@/components/sections/FeaturedBuild';
import { Hero } from '@/components/sections/Hero';
import { Parts } from '@/components/sections/Parts';
import { Platforms } from '@/components/sections/Platforms';
import { Process } from '@/components/sections/Process';
import { Services } from '@/components/sections/Services';
import { HomeV2 } from '@/components/v2/home/HomeV2';
import { HomeV3 } from '@/components/v3/home/HomeV3';
import { getSiteContent } from '@/lib/site-content/read';
import { list } from '@/lib/site-content/values';

export default async function Home() {
  const content = await getSiteContent();
  const order = list(content.block('home.sections'), 'order');

  if (content.design === 'v3') return <HomeV3 order={order} content={content} />;
  if (content.design === 'v2') return <HomeV2 order={order} content={content} />;

  const sections: Record<string, React.ReactNode> = {
    hero: <Hero values={content.block('home.hero')} />,
    platforms: <Platforms />,
    services: <Services values={content.block('home.services')} />,
    builds: <FeaturedBuild />,
    parts: <Parts values={content.block('home.parts')} />,
    process: <Process />,
    reviews: <ReviewStrip />,
    quote: (
      <Suspense fallback={<QuoteSection values={content.block('home.quote')} />}>
        <QuoteSectionFromUrl values={content.block('home.quote')} />
      </Suspense>
    ),
  };

  // Fragments, not wrappers: a div here would break sticky columns and bleed backgrounds.
  return <>{order.map((id) => <Fragment key={id}>{sections[id]}</Fragment>)}</>;
}
