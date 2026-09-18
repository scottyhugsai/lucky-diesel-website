import { BUSINESS } from '@/lib/site';

/**
 * The strip retailers in this category run above the header. Every line here is
 * a fact the shop can stand behind — no invented shipping promises, no
 * countdowns, no "5-star rated" for a business with no reviews yet.
 */
const FACTS = [
  'EZ Lynk & DDP parts',
  `${BUSINESS.city}, ${BUSINESS.region}`,
  'Emissions equipment stays intact',
  'Written estimate before any work',
] as const;

function Facts({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className={`v4-marquee-track flex items-center gap-x-5 whitespace-nowrap sm:justify-center ${hidden ? 'v4-marquee-copy' : ''}`}>
      {FACTS.map((fact) => (
        <li key={fact} className="flex items-center gap-5">
          <span aria-hidden="true" className="v4-sep opacity-40">·</span>
          {fact}
        </li>
      ))}
    </ul>
  );
}

export function TickerV4() {
  return (
    <div className="v4-ticker">
      {/* One line always. On a phone the strip is wider than the screen, so it
          scrolls sideways by hand — or, where the browser can animate it, drifts
          past on its own as a marquee: the second copy of the list is what lets
          the loop join up seamlessly. It is hidden unless the marquee runs. */}
      <div className="v4-marquee v4-scroll mx-auto flex max-w-[1180px] overflow-x-auto px-5 py-1.5 sm:justify-center sm:px-8">
        <Facts />
        <Facts hidden />
      </div>
    </div>
  );
}
