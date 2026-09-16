import { Suspense } from 'react';
import { QuoteSection, QuoteSectionFromUrl } from '@/components/quote/QuoteSection';
import { FeaturedBuild } from '@/components/sections/FeaturedBuild';
import { Hero } from '@/components/sections/Hero';
import { Parts } from '@/components/sections/Parts';
import { Platforms } from '@/components/sections/Platforms';
import { Process } from '@/components/sections/Process';
import { Services } from '@/components/sections/Services';

export default function Home() {
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
