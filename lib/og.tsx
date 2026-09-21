import { ImageResponse } from 'next/og';
import { BUSINESS } from '@/lib/site';

/**
 * One share card, rendered per route.
 *
 * Every link on this site shared the same card, because there was no
 * `opengraph-image` anywhere in the tree — and this is a business whose funnel
 * is Instagram, TikTok and texting people links. A part sent to a customer, a
 * generation page sent to somebody asking what fits their LML, and the home
 * page were indistinguishable in the preview.
 *
 * Generated rather than shipped as binary assets: there is no `/og-image.jpg`
 * to lose track of, and the palette below cannot drift from `globals.css`
 * without someone editing this file on purpose.
 *
 * No webfont is loaded on purpose. Fetching Barlow Condensed at render time
 * would put a network call between a crawler and a share preview, and fail
 * closed in a build with no egress. Scale, colour and spacing carry the brand.
 */

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CARBON = '#0a0c0b';
const CARBON_2 = '#121614';
const CHALK = '#eef2ef';
const STEEL = '#8c9590';
const CLOVER = '#1fbf3f';

/** Long titles step down rather than overflowing the card. */
function titleSize(title: string): number {
  if (title.length > 58) return 58;
  if (title.length > 38) return 72;
  return 88;
}

export function ogAlt(what: string): string {
  return `${what} — ${BUSINESS.name}, ${BUSINESS.city}, ${BUSINESS.region}`;
}

export interface OgInput {
  /** Small line above the headline: the section, platform or category. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Absolute URL of a product photograph, shown beside the copy. */
  image?: string;
}

export function ogImage({ eyebrow, title, subtitle, image }: OgInput): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: CARBON,
          padding: '64px 72px',
          fontFamily: 'sans-serif',
          position: 'relative',
          // The one piece of surface treatment, matching the site's panels.
          backgroundImage: `linear-gradient(140deg, ${CARBON_2} 0%, ${CARBON} 55%)`,
        }}
      >
        {/* A part link is the thing this shop texts most, so the photograph
            comes along — with the name, the price and the shop on it, which a
            bare product shot carries none of. */}
        {image && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: 430,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#ffffff',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders
                this to a PNG on the server; next/image has no meaning here. */}
            <img src={image} width={380} height={380} style={{ objectFit: 'contain' }} alt="" />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', width: 14, height: 14, background: CLOVER, borderRadius: 2 }} />
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: CHALK, letterSpacing: 1 }}>
            {BUSINESS.name.toUpperCase()}
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: STEEL, letterSpacing: 3, textTransform: 'uppercase' }}>
            {BUSINESS.city}, {BUSINESS.region}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {eyebrow && (
            <div style={{ display: 'flex', fontSize: 22, color: CLOVER, letterSpacing: 4, textTransform: 'uppercase', fontWeight: 700 }}>
              {eyebrow}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              fontSize: titleSize(title),
              fontWeight: 800,
              color: CHALK,
              lineHeight: 1.02,
              letterSpacing: -2,
              maxWidth: image ? 640 : 1000,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ display: 'flex', fontSize: 28, color: STEEL, lineHeight: 1.3, maxWidth: image ? 620 : 900 }}>{subtitle}</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: CHALK }}>{BUSINESS.phoneDisplay}</div>
          {/* The platform line would run under the photo panel, and a card with
              a product on it does not need telling what the shop works on. */}
          {!image && (
            <div style={{ display: 'flex', fontSize: 22, color: STEEL, letterSpacing: 2, textTransform: 'uppercase' }}>
              Duramax · Powerstroke · Cummins
            </div>
          )}
        </div>
      </div>
    ),
    size,
  );
}
