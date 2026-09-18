import { Suspense } from 'react';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { SkipLink } from '@/components/layout/SkipLink';
import { ClosureBanner } from '@/components/seo/ClosureBanner';
import { DesignToggle } from '@/components/design/DesignToggle';
import { MobileActionBar } from '@/components/layout/MobileActionBar';
import { MarketingWidgets } from '@/components/marketing-public/MarketingWidgets';
import { PreviewBar } from '@/components/layout/PreviewBar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { CartDrawer } from '@/components/store/CartDrawer';
import { CartProvider } from '@/components/store/CartProvider';
import { SiteFooterV2 } from '@/components/v2/SiteFooterV2';
import { SiteHeaderV2 } from '@/components/v2/SiteHeaderV2';
import { DESIGN_LABELS, getDesign } from '@/lib/design';
import { loadBannerClosure } from '@/lib/marketing/content/seo-public';
import { getSiteContent } from '@/lib/site-content/read';
import { resolveNav } from '@/lib/site-nav';

/**
 * v3 is imported on demand so next/font only preloads Space Grotesk and
 * JetBrains Mono for visitors on the Telemetry design.
 */
async function loadV3() {
  const [{ V3Shell }, { V3_FONT_CLASS }] = await Promise.all([import('@/components/v3/V3Shell'), import('@/components/v3/fonts')]);
  return { V3Shell, fontClass: V3_FONT_CLASS };
}

/** Same deal for Vector: only its visitors download Inter Tight. */
async function loadV4() {
  const [{ SiteHeaderV4 }, { SiteFooterV4 }, { TickerV4 }, { ScrollProgress }, { V4_FONT_CLASS }] = await Promise.all([
    import('@/components/v4/SiteHeaderV4'),
    import('@/components/v4/SiteFooterV4'),
    import('@/components/v4/TickerV4'),
    import('@/components/v4/ScrollProgress'),
    import('@/components/v4/fonts'),
  ]);
  return { SiteHeaderV4, SiteFooterV4, TickerV4, ScrollProgress, fontClass: V4_FONT_CLASS };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [design, content, closure] = await Promise.all([getDesign(), getSiteContent(), loadBannerClosure()]);
  const isV2 = design === 'v2';
  const v3 = design === 'v3' ? await loadV3() : null;
  const v4 = design === 'v4' ? await loadV4() : null;
  const nav = resolveNav(content.block('nav.primary'));

  return (
    <CartProvider>
      <SkipLink />
      <div data-design={design} className={`min-h-dvh bg-carbon ${v3?.fontClass ?? ''} ${v4?.fontClass ?? ''}`}>
        {v3 ? (
          // v3 brings its own top bar, tab bar, call/text pill and footer in place of MobileActionBar.
          <v3.V3Shell nav={nav}>{children}</v3.V3Shell>
        ) : v4 ? (
          <>
            <v4.TickerV4 />
            <v4.SiteHeaderV4 nav={nav} />
            <v4.ScrollProgress />
            <main id="main">{children}</main>
            <v4.SiteFooterV4 nav={nav} />
            <MobileActionBar />
          </>
        ) : (
          <>
            {isV2 ? <SiteHeaderV2 nav={nav} /> : <SiteHeader nav={nav} />}
            <main id="main">{children}</main>
            {isV2 ? <SiteFooterV2 nav={nav} /> : <SiteFooter nav={nav} />}
            <MobileActionBar />
          </>
        )}
        {/* One notice slot: shop hours beat a promotion. */}
        {closure ? <ClosureBanner closure={closure} /> : <AnnouncementBar values={content.block('announcement')} />}
        <CartDrawer />
        <MarketingWidgets design={design} />
        <Suspense>
          <DesignToggle design={design} labels={DESIGN_LABELS} />
        </Suspense>
        {content.preview && <PreviewBar />}
      </div>
    </CartProvider>
  );
}
