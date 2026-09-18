import { CallTextPill } from './CallTextPill';
import { FooterV3 } from './FooterV3';
import { StickyBuyBar } from './StickyBuyBar';
import { TabBarV3 } from './TabBarV3';
import { TopBarV3 } from './TopBarV3';
import type { SiteNav } from '@/lib/site-nav';
import { getNextOpenSlot } from './data';

/** Telemetry chrome: top bar, tab bar, call/text pill, sticky buy bar and footer. Font variables are applied by the layout on the data-design element. */
export async function V3Shell({ children, nav }: { children: React.ReactNode; nav?: SiteNav }) {
  const nextSlot = await getNextOpenSlot();
  return (
    <div className="v3-root min-h-dvh bg-carbon">
      <TopBarV3 nextSlot={nextSlot} nav={nav} />
      <main>{children}</main>
      <FooterV3 />
      <StickyBuyBar />
      <CallTextPill />
      <TabBarV3 nav={nav} />
    </div>
  );
}
