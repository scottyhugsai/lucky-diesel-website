import { Suspense } from 'react';
import { DesignToggle } from '@/components/design/DesignToggle';
import { MobileActionBar } from '@/components/layout/MobileActionBar';
import { MarketingWidgets } from '@/components/marketing-public/MarketingWidgets';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { CartDrawer } from '@/components/store/CartDrawer';
import { CartProvider } from '@/components/store/CartProvider';
import { SiteFooterV2 } from '@/components/v2/SiteFooterV2';
import { SiteHeaderV2 } from '@/components/v2/SiteHeaderV2';
import { DESIGN_LABELS, getDesign } from '@/lib/design';

/**
 * v3 is imported on demand so next/font only preloads Space Grotesk and
 * JetBrains Mono for visitors on the Telemetry design.
 */
async function loadV3() {
  const [{ V3Shell }, { V3_FONT_CLASS }] = await Promise.all([import('@/components/v3/V3Shell'), import('@/components/v3/fonts')]);
  return { V3Shell, fontClass: V3_FONT_CLASS };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const design = await getDesign();
  const isV2 = design === 'v2';
  const v3 = design === 'v3' ? await loadV3() : null;
  return (
    <CartProvider>
      <div data-design={design} className={`min-h-dvh bg-carbon ${v3?.fontClass ?? ''}`}>
        {v3 ? (
          // v3 brings its own top bar, tab bar, call/text pill and footer in place of MobileActionBar.
          <v3.V3Shell>{children}</v3.V3Shell>
        ) : (
          <>
            {isV2 ? <SiteHeaderV2 /> : <SiteHeader />}
            <main>{children}</main>
            {isV2 ? <SiteFooterV2 /> : <SiteFooter />}
            <MobileActionBar />
          </>
        )}
        <CartDrawer />
        <MarketingWidgets design={design} />
        <Suspense>
          <DesignToggle design={design} labels={DESIGN_LABELS} />
        </Suspense>
      </div>
    </CartProvider>
  );
}
