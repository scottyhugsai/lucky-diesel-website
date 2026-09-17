import type { ReactNode } from 'react';
import { BRAND_COLORS as C } from '../brand';

/** Shared chrome for every ad image: brand ground, logo tile, footer with CTA. Satori subset of CSS only. */

export interface Canvas {
  width: number;
  height: number;
  /** 1 unit = 1px on a 1080px-short-side canvas. */
  u: number;
  landscape: boolean;
  tall: boolean;
}

export function canvasFor(width: number, height: number): Canvas {
  return { width, height, u: Math.min(width, height) / 1080, landscape: width / height > 1.4, tall: height / width > 1.5 };
}

export const DISPLAY = 'Barlow Condensed';
export const BODY = 'Barlow';

export function Display({ size, color = C.chalk, children, style }: { size: number; color?: string; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', fontFamily: DISPLAY, fontStyle: 'italic', fontWeight: 800, fontSize: size, lineHeight: 0.9, letterSpacing: -0.5, textTransform: 'uppercase', color, ...style }}>
      {children}
    </div>
  );
}

export function Kicker({ u, children, color = C.clover }: { u: number; children: ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', fontFamily: DISPLAY, fontStyle: 'italic', fontWeight: 800, fontSize: 30 * u, letterSpacing: 5 * u, textTransform: 'uppercase', color }}>
      {children}
    </div>
  );
}

/** Photo as a darkened backdrop; the gradient keeps text readable over any image. */
export function Backdrop({ photo, strength = 0.82 }: { photo: string | null; strength?: number }) {
  if (!photo) {
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', background: `radial-gradient(circle at 85% 10%, rgba(31,191,63,0.22), transparent 55%), linear-gradient(160deg, ${C.carbon2} 0%, ${C.carbon} 70%)` }} />
    );
  }
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', background: `linear-gradient(180deg, rgba(10,12,11,${strength - 0.25}) 0%, rgba(10,12,11,${strength}) 55%, rgba(10,12,11,0.96) 100%)` }} />
    </div>
  );
}

function Stripes({ u }: { u: number }) {
  return (
    <div style={{ position: 'absolute', top: 0, right: 90 * u, display: 'flex', gap: 14 * u, transform: 'skewX(-28deg)' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 16 * u, height: 70 * u, background: C.clover, opacity: 1 - i * 0.3 }} />
      ))}
    </div>
  );
}

export interface FrameProps {
  canvas: Canvas;
  photo: string | null;
  logo: string | null;
  kicker: string | null;
  cta: string;
  footnote?: string | null;
  label?: string | null;
  children: ReactNode;
}

export function Frame({ canvas, photo, logo, kicker, cta, footnote, label, children }: FrameProps) {
  const { u } = canvas;
  const pad = (canvas.landscape ? 56 : 72) * u;
  return (
    <div style={{ width: canvas.width, height: canvas.height, display: 'flex', position: 'relative', background: C.carbon, color: C.chalk, fontFamily: BODY, overflow: 'hidden' }}>
      <Backdrop photo={photo} />
      <Stripes u={u} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: pad }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 * u }}>
            {logo ? (
              <div style={{ display: 'flex', width: 104 * u, height: 104 * u, borderRadius: 18 * u, background: C.chalk, alignItems: 'center', justifyContent: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="Lucky Diesel" width={80 * u} height={90 * u} style={{ objectFit: 'contain' }} />
              </div>
            ) : (
              <Display size={44 * u} color={C.clover}>Lucky Diesel</Display>
            )}
            {kicker ? <Kicker u={u}>{kicker}</Kicker> : null}
          </div>
          {label ? (
            <div style={{ display: 'flex', padding: `${6 * u}px ${14 * u}px`, border: `${2 * u}px solid ${C.steel}`, background: 'rgba(10,12,11,0.85)', color: C.chalk, fontSize: 20 * u, letterSpacing: 3 * u, textTransform: 'uppercase' }}>{label}</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center' }}>{children}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 * u }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 * u }}>
            <div style={{ display: 'flex', fontSize: 28 * u, fontWeight: 700, color: C.chalk }}>luckydiesel.com · (843) 995-9252</div>
            {footnote ? <div style={{ display: 'flex', fontSize: 20 * u, color: C.steel }}>{footnote}</div> : null}
          </div>
          <div style={{ display: 'flex', background: C.clover, color: C.carbon, padding: `${16 * u}px ${34 * u}px`, borderRadius: 6 * u, transform: 'skewX(-8deg)' }}>
            <Display size={40 * u} color={C.carbon}>{cta}</Display>
          </div>
        </div>
      </div>
    </div>
  );
}
