import { Suspense } from 'react';
import { DesignToggle } from '@/components/design/DesignToggle';
import { MobileActionBar } from '@/components/layout/MobileActionBar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { CartDrawer } from '@/components/store/CartDrawer';
import { CartProvider } from '@/components/store/CartProvider';
import { SiteFooterV2 } from '@/components/v2/SiteFooterV2';
import { SiteHeaderV2 } from '@/components/v2/SiteHeaderV2';
import { DESIGN_LABELS, getDesign } from '@/lib/design';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const design = await getDesign();
  const isV2 = design === 'v2';
  return (
    <CartProvider>
      <div data-design={design} className="min-h-dvh bg-carbon">
        {isV2 ? <SiteHeaderV2 /> : <SiteHeader />}
        <main>{children}</main>
        {isV2 ? <SiteFooterV2 /> : <SiteFooter />}
        <MobileActionBar />
        <CartDrawer />
        <Suspense>
          <DesignToggle design={design} labels={DESIGN_LABELS} />
        </Suspense>
      </div>
    </CartProvider>
  );
}
