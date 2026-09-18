import { SECTION, SectionHead, WRAP } from '../ui';

const STEPS = [
  { title: 'Pick your truck', body: 'Year, make, model, engine. Four taps.' },
  { title: 'Tell us the goal', body: 'Sorted, towing, or built for boost.' },
  { title: 'Get it in writing', body: 'Parts, labour and a date. Then we build it.' },
] as const;

export function ProcessV4() {
  return (
    <section aria-labelledby="process-v4-heading" className={`v4-rise ${SECTION} relative isolate overflow-hidden border-t border-line bg-carbon`}>
      {/* Decorative: a generated scanline band, set as a horizon under the
          three steps and never under copy. Not a readout of anything. */}
      <div aria-hidden="true" className="v4-art v4-art-scan" />
      <div className={WRAP}>
        <SectionHead id="process-v4-heading" index="How it works" title="Three steps" />
        {/* A sequence, drawn as one. Three boxed cells said "three things";
            the run of rule with stops on it says "this, then this, then this",
            which is what the section is actually for. Steps land one after
            another and the numeral on each drops in last, so the eye reads
            01, 02, 03 in the order the shop works. */}
        <ol className="v4-stagger mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((item, index) => (
            <li key={item.title} className="relative md:pt-8">
              {/* The rule and its stop, from md up: the line runs the width of
                  the row and each step sits on it. */}
              <span aria-hidden="true" className="absolute inset-x-0 top-1 hidden h-px bg-line md:block" />
              <span aria-hidden="true" className="absolute left-0 top-0 hidden size-2 rounded-full bg-clover md:block" />
              <span className="v4-num v4-title v4-drop block text-5xl text-clover">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="v4-title mt-3 text-xl">{item.title}</h3>
              <p className="mt-2 max-w-xs text-[0.9375rem] leading-snug text-steel">{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
