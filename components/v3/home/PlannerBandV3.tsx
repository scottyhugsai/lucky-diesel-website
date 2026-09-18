import { PlannerTeaser } from '@/components/planner/PlannerTeaser';
import { SECTION, WRAP } from '../ui';

/**
 * The one violet element on the page. The teaser's own button turns violet via
 * the .v3-planner scope in globals.css.
 *
 * The wrapper is a plain div: PlannerTeaser is already the labelled section, and
 * nesting a second one with the same label duplicates the landmark.
 */
export function PlannerBandV3() {
  return (
    <div className={`${SECTION} v3-planner-band`}>
      <div className={WRAP}>
        <p className="mb-4 max-w-xl text-[1.0625rem] leading-snug text-chalk/80">Pick your truck and a goal. Get a parts list with real prices in a minute.</p>
        <PlannerTeaser className="v3-planner" />
      </div>
    </div>
  );
}
