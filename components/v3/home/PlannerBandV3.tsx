import { PlannerTeaser } from '@/components/planner/PlannerTeaser';
import { SECTION, WRAP } from '../ui';

/** The one violet element on the page. The teaser's own button turns violet via the .v3-planner scope in globals.css. */
export function PlannerBandV3() {
  return (
    <section aria-labelledby="planner-teaser" className={`${SECTION} v3-planner-band`}>
      <div className={WRAP}>
        <p className="mb-4 max-w-xl text-[1.0625rem] leading-snug text-chalk/80">Pick your truck and a goal. Get a parts list with real prices in a minute.</p>
        <PlannerTeaser className="v3-planner" />
      </div>
    </section>
  );
}
