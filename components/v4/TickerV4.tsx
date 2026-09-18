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

export function TickerV4() {
  return (
    <div className="v4-ticker">
      {/* One line always: on a phone it scrolls sideways rather than stacking
          into a three-line block above the header. */}
      <ul className="v4-scroll mx-auto flex max-w-[1180px] items-center gap-x-5 overflow-x-auto whitespace-nowrap px-5 py-1.5 sm:justify-center sm:px-8">
        {FACTS.map((fact, index) => (
          <li key={fact} className="flex items-center gap-5">
            {index > 0 && <span aria-hidden="true" className="opacity-40">·</span>}
            {fact}
          </li>
        ))}
      </ul>
    </div>
  );
}
