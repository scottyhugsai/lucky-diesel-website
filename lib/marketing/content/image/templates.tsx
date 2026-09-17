import { BRAND_COLORS as C, CTA_LABELS } from '../brand';
import type { ImageTemplate } from '../types';
import { Display, Frame, Kicker, type Canvas } from './frame';

export type ImageParams = Record<string, string | number | boolean | null | undefined>;

export interface TemplateInput {
  template: ImageTemplate;
  canvas: Canvas;
  params: ImageParams;
  headline: string;
  cta: string;
  /** Data URLs, already loaded. */
  photo: string | null;
  logo: string | null;
  label: string | null;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' ? String(value) : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null);

function Bar({ u, label, before, after, unit }: { u: number; label: string; before: number | null; after: number; unit: string }) {
  const max = Math.max(before ?? 0, after);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * u }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Kicker u={u} color={C.steel}>{label}</Kicker>
        {before ? <Display size={48 * u} color={C.clover}>{`+${after - before} ${unit}`}</Display> : null}
      </div>
      {before ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 * u }}>
          <div style={{ display: 'flex', width: 90 * u, fontSize: 24 * u, color: C.steel }}>Stock</div>
          <div style={{ display: 'flex', flex: 1, height: 22 * u, background: C.gunmetal }}>
            <div style={{ display: 'flex', width: `${(before / max) * 100}%`, background: C.steel }} />
          </div>
          <div style={{ display: 'flex', width: 110 * u, justifyContent: 'flex-end', fontSize: 30 * u, fontWeight: 700 }}>{String(before)}</div>
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 * u }}>
        <div style={{ display: 'flex', width: 90 * u, fontSize: 24 * u, color: C.steel }}>{before ? 'After' : 'Pull'}</div>
        <div style={{ display: 'flex', flex: 1, height: 22 * u, background: C.gunmetal }}>
          <div style={{ display: 'flex', width: '100%', background: C.clover }} />
        </div>
        <div style={{ display: 'flex', width: 110 * u, justifyContent: 'flex-end', fontSize: 30 * u, fontWeight: 700, color: C.clover }}>{String(after)}</div>
      </div>
    </div>
  );
}

function Dyno({ canvas, params, headline }: TemplateInput) {
  const { u } = canvas;
  const hp = num(params.afterHp);
  const tq = num(params.afterTq);
  return (
    <div style={{ display: 'flex', flexDirection: canvas.landscape ? 'row' : 'column', gap: (canvas.landscape ? 60 : 44) * u, alignItems: canvas.landscape ? 'center' : 'stretch' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 * u, ...(canvas.landscape ? { flex: 1 } : {}) }}>
        <Kicker u={u}>{text(params.truck) ?? 'On our dyno'}</Kicker>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 * u }}>
          {hp ? <Display size={(canvas.landscape ? 170 : 220) * u}>{String(hp)}</Display> : null}
          {hp ? <Display size={64 * u} color={C.clover} style={{ marginBottom: 18 * u }}>HP</Display> : null}
        </div>
        {tq ? <Display size={(canvas.landscape ? 64 : 84) * u} color={C.chalk}>{`${tq} lb-ft`}</Display> : null}
        <div style={{ display: 'flex', fontSize: 34 * u, color: C.chalk, opacity: 0.8, marginTop: 8 * u, maxWidth: 880 * u }}>{headline}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 * u, ...(canvas.landscape ? { flex: 1 } : {}) }}>
        {hp ? <Bar u={u} label="Horsepower" before={num(params.beforeHp)} after={hp} unit="HP" /> : null}
        {tq ? <Bar u={u} label="Torque" before={num(params.beforeTq)} after={tq} unit="LB-FT" /> : null}
      </div>
    </div>
  );
}

function Product({ canvas, params, headline, photo }: TemplateInput) {
  const { u } = canvas;
  const stacked = canvas.tall || canvas.height > canvas.width;
  const size = (canvas.landscape ? 420 : stacked ? (canvas.tall ? 760 : 560) : 430) * u;
  return (
    <div style={{ display: 'flex', flexDirection: stacked ? 'column' : 'row', gap: 48 * u, alignItems: 'center' }}>
      <div style={{ display: 'flex', flexShrink: 0, width: size, height: size, background: C.chalk, borderRadius: 10 * u, alignItems: 'center', justifyContent: 'center', transform: 'rotate(-2deg)' }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" width={size * 0.86} height={size * 0.86} style={{ objectFit: 'contain' }} />
        ) : (
          <Display size={60 * u} color={C.carbon}>{text(params.vendor) ?? 'In stock'}</Display>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 * u, width: stacked ? '100%' : 460 * u, alignItems: stacked ? 'center' : 'flex-start' }}>
        <Kicker u={u}>{text(params.vendor) ?? 'Parts + install'}</Kicker>
        <Display size={(stacked ? 80 : 68) * u} style={{ textAlign: stacked ? 'center' : 'left', lineHeight: 0.95 }}>{text(params.product) ?? headline}</Display>
        {text(params.price) ? <Display size={60 * u} color={C.clover}>{`From ${text(params.price)}`}</Display> : null}
        <div style={{ display: 'flex', fontSize: 26 * u, color: C.steel, textAlign: stacked ? 'center' : 'left' }}>Parts price. Installed by our Charleston techs.</div>
      </div>
    </div>
  );
}

function Offer({ canvas, params, headline }: TemplateInput) {
  const { u } = canvas;
  const code = text(params.code);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 * u }}>
      <Kicker u={u}>{text(params.offer) && text(params.offer)!.toLowerCase() !== headline.toLowerCase() ? text(params.offer) : 'Limited offer'}</Kicker>
      <Display size={(canvas.landscape ? 150 : 190) * u} color={C.clover}>{text(params.value) ?? headline}</Display>
      <Display size={(canvas.landscape ? 56 : 68) * u} style={{ maxWidth: 920 * u }}>{headline}</Display>
      <div style={{ display: 'flex', gap: 18 * u, alignItems: 'center', marginTop: 10 * u }}>
        {code ? <div style={{ display: 'flex', border: `${3 * u}px dashed ${C.clover}`, padding: `${8 * u}px ${20 * u}px`, fontSize: 32 * u, fontWeight: 700, letterSpacing: 3 * u }}>{code}</div> : null}
        {text(params.ends) ? <div style={{ display: 'flex', fontSize: 30 * u, color: C.chalk }}>{`Ends ${text(params.ends)}`}</div> : null}
      </div>
    </div>
  );
}

function Seasonal({ canvas, params, headline }: TemplateInput) {
  const { u } = canvas;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 * u, justifyContent: 'flex-end', flex: 1, paddingBottom: 24 * u }}>
      <Kicker u={u}>{text(params.service) ?? 'This season'}</Kicker>
      <Display size={(canvas.landscape ? 110 : 132) * u} style={{ maxWidth: 960 * u }}>{text(params.title) ?? headline}</Display>
      <div style={{ display: 'flex', width: 180 * u, height: 10 * u, background: C.clover, transform: 'skewX(-28deg)' }} />
    </div>
  );
}

function Review({ canvas, params, headline }: TemplateInput) {
  const { u } = canvas;
  const rating = Math.min(Math.max(num(params.rating) ?? 5, 1), 5);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 * u }}>
      <Display size={220 * u} color={C.clover} style={{ height: 120 * u }}>“</Display>
      <div style={{ display: 'flex', fontSize: (canvas.landscape ? 50 : 60) * u, fontWeight: 700, lineHeight: 1.18, maxWidth: 940 * u }}>{text(params.quote) ?? headline}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 * u }}>
        <div style={{ display: 'flex', gap: 6 * u }}>
          {Array.from({ length: rating }, (_, i) => (
            <svg key={i} width={40 * u} height={40 * u} viewBox="0 0 24 24">
              <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.3L12 17.8 5.7 21.5l1.7-7.3L2 9.5l7.1-.6z" fill={C.clover} />
            </svg>
          ))}
        </div>
        <div style={{ display: 'flex', fontSize: 30 * u, color: C.steel }}>{`${text(params.author) ?? 'Customer'} · ${text(params.source) ?? 'customer'} review`}</div>
      </div>
    </div>
  );
}

function BeforeAfter({ canvas, params, headline }: TemplateInput) {
  const { u } = canvas;
  const chips: [string, number | null, number | null][] = [['HP', num(params.beforeHp), num(params.afterHp)], ['LB-FT', num(params.beforeTq), num(params.afterTq)]];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 * u, justifyContent: 'flex-end', flex: 1 }}>
      <Kicker u={u}>{text(params.truck) ?? 'Build'}</Kicker>
      <Display size={(canvas.landscape ? 84 : 104) * u} style={{ maxWidth: 960 * u }}>{text(params.title) ?? headline}</Display>
      <div style={{ display: 'flex', gap: 18 * u, flexWrap: 'wrap' }}>
        {chips.filter(([, b, a]) => b && a).map(([unit, b, a]) => (
          <div key={unit} style={{ display: 'flex', alignItems: 'center', gap: 14 * u, background: 'rgba(10,12,11,0.85)', border: `${2 * u}px solid ${C.clover}`, padding: `${10 * u}px ${22 * u}px` }}>
            <Display size={48 * u} color={C.steel}>{String(b)}</Display>
            <Display size={40 * u} color={C.chalk}>→</Display>
            <Display size={56 * u} color={C.clover}>{`${a} ${unit}`}</Display>
          </div>
        ))}
      </div>
    </div>
  );
}

function Photo({ canvas, params, headline }: TemplateInput) {
  const { u } = canvas;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 * u, justifyContent: 'flex-end', flex: 1 }}>
      <Kicker u={u}>{text(params.truck) ?? 'Lucky Diesel'}</Kicker>
      <Display size={(canvas.landscape ? 90 : 116) * u} style={{ maxWidth: 960 * u }}>{headline}</Display>
    </div>
  );
}

const BODIES: Record<ImageTemplate, (input: TemplateInput) => React.ReactElement> = {
  dyno: Dyno, product: Product, offer: Offer, seasonal: Seasonal, review: Review, before_after: BeforeAfter, photo: Photo,
};

const KICKERS: Record<ImageTemplate, string | null> = { dyno: 'Dyno sheet', product: 'Parts + install', offer: 'Offer', seasonal: null, review: 'Real review', before_after: 'Build', photo: null };

const FOOTNOTES: Partial<Record<ImageTemplate, string>> = {
  dyno: 'Results vary by truck, fuel and conditions.',
  before_after: 'Results vary by truck, fuel and conditions.',
  offer: 'Terms apply. See site for details.',
};

/** Which templates draw the photo as a full backdrop (product shows it on a card instead). */
export const BACKDROP_TEMPLATES: readonly ImageTemplate[] = ['offer', 'seasonal', 'review', 'before_after', 'photo'];

export function AdImage(input: TemplateInput) {
  const Body = BODIES[input.template];
  const backdrop = BACKDROP_TEMPLATES.includes(input.template) ? input.photo : null;
  return (
    <Frame canvas={input.canvas} photo={backdrop} logo={input.logo} kicker={KICKERS[input.template]} cta={CTA_LABELS[input.cta] ?? input.cta} footnote={FOOTNOTES[input.template] ?? null} label={input.label}>
      <Body {...input} />
    </Frame>
  );
}
