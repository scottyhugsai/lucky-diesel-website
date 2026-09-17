import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Planner } from '@/components/planner/Planner';
import { hasFitment } from '@/components/planner/recommend';
import { toPlannerProducts, type PlannerProduct } from '@/components/planner/product';
import { parsePlannerState } from '@/components/planner/state';
import { getCatalog } from '@/lib/store/catalog';
import { BUSINESS, PLATFORMS } from '@/lib/site';

export const metadata: Metadata = {
  title: `Diesel Build Planner | Lucky Diesel ${BUSINESS.city}`,
  description: 'Pick your truck and goal. Get a staged Duramax, Powerstroke or Cummins build from parts that fit.',
  alternates: { canonical: '/build-planner' },
};

interface BuildPlannerPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BuildPlannerPage({ searchParams }: BuildPlannerPageProps) {
  const state = parsePlannerState(await searchParams);
  const platform = PLATFORMS.find((p) => p.id === state.platform);

  let products: PlannerProduct[] = [];
  let catalogOk = true;
  const generationCounts: Record<string, number> = {};

  if (platform) {
    const catalog = await getCatalog();
    catalogOk = catalog.ok;
    // Only this platform's planner parts reach the browser.
    products = toPlannerProducts(catalog.products, platform.id);
    for (const handle of platform.generationCollections) {
      const truck = { platform: platform.id, generationCollection: handle };
      generationCounts[handle] = hasFitment(products, truck)
        ? products.filter((p) => p.generationCollections.includes(handle)).length
        : 0;
    }
  }

  return (
    <Suspense>
      <Planner productsPlatform={platform?.id ?? null} products={products} catalogOk={catalogOk} generationCounts={generationCounts} />
    </Suspense>
  );
}
