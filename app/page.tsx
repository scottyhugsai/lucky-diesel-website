import { Suspense } from 'react';
import { MobileActionBar } from '@/components/layout/MobileActionBar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
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
      <SiteHeader />
      <main>
        <Hero />
        <Platforms />
        <Services />
        <FeaturedBuild />
        <Parts />
        <Process />
        <Suspense fallback={<QuoteSection />}>
          <QuoteSectionFromUrl />
        </Suspense>
      </main>
      <SiteFooter />
      <MobileActionBar />
    </>
  );
}
