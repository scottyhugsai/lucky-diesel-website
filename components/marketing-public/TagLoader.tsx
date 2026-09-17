'use client';

import Script from 'next/script';
import type { TagConfig } from '@/lib/marketing/engage/tags';
import type { ConsentChoice } from '@/lib/marketing/engage/rules';

interface TagLoaderProps {
  config: TagConfig;
  choice: ConsentChoice | null;
}

/**
 * Loads only the tags the visitor allowed, and only those whose id is set in the
 * env. Google tags start with Consent Mode v2 denied and are updated from the
 * saved choice, so nothing is stored before the answer.
 */
export function TagLoader({ config, choice }: TagLoaderProps) {
  if (!choice) return null;
  const analytics = choice.analytics;
  const ads = choice.ads;
  const googleId = (analytics && config.ga4) || (ads && config.googleAds) || null;
  const adsSendTo = ads && config.googleAds && config.googleAdsLeadLabel ? `${config.googleAds}/${config.googleAdsLeadLabel}` : null;

  return (
    <>
      {googleId && (
        <>
          <Script id="gtag-src" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${googleId}`} />
          <Script id="gtag-init" strategy="afterInteractive">{`
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
gtag('consent','update',{ad_storage:'${ads ? 'granted' : 'denied'}',ad_user_data:'${ads ? 'granted' : 'denied'}',ad_personalization:'${ads ? 'granted' : 'denied'}',analytics_storage:'${analytics ? 'granted' : 'denied'}'});
gtag('js',new Date());
${analytics && config.ga4 ? `gtag('config','${config.ga4}',{send_page_view:true});` : ''}
${ads && config.googleAds ? `gtag('config','${config.googleAds}',{allow_enhanced_conversions:true});` : ''}
${adsSendTo ? `window.__ldAdsLead='${adsSendTo}';` : ''}
          `}</Script>
        </>
      )}

      {analytics && config.clarity && (
        <Script id="clarity" strategy="afterInteractive">{`
(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${config.clarity}");
        `}</Script>
      )}

      {ads && config.metaPixel && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${config.metaPixel}');fbq('track','PageView');
        `}</Script>
      )}

      {ads && config.tiktokPixel && (
        <Script id="tiktok-pixel" strategy="afterInteractive">{`
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
ttq.setAndDefer=function(e,n){e[n]=function(){e.push([n].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.load=function(e){var n="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=n;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]={};
var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=n+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${config.tiktokPixel}');ttq.page();}(window,document,'ttq');
        `}</Script>
      )}
    </>
  );
}
