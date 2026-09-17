import { Suspense } from 'react';
import { QuoteSection, QuoteSectionFromUrl } from '@/components/quote/QuoteSection';
import { FeaturedBuild } from '@/components/sections/FeaturedBuild';
import { Hero } from '@/components/sections/Hero';
import { Parts } from '@/components/sections/Parts';
import { Platforms } from '@/components/sections/Platforms';
import { Process } from '@/components/sections/Process';
import { Services } from '@/components/sections/Services';
import { HomeV2 } from '@/components/v2/home/HomeV2';
import { HomeV3 } from '@/components/v3/home/HomeV3';
import { getDesign } from '@/lib/design';

export default async function Home() {
  const design = await getDesign();
  if (design === 'v3') return <HomeV3 />;
  if (design === 'v2') return <HomeV2 />;
  return (
    <>
      <Hero />
      <Platforms />
      <Services />
      <FeaturedBuild />
      <Parts />
      <Process />
      <Suspense fallback={<QuoteSection />}>
        <QuoteSectionFromUrl />
      </Suspense>
    </>
  );
}
