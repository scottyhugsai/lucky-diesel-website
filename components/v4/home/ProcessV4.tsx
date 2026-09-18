import { SECTION, SectionHead, WRAP } from '../ui';

const STEPS = [
  { title: 'Pick your truck', body: 'Year, make, model, engine. Four taps.' },
  { title: 'Tell us the goal', body: 'Sorted, towing, or built for boost.' },
  { title: 'Get it in writing', body: 'Parts, labour and a date. Then we build it.' },
] as const;

export function ProcessV4({ step }: { step: string }) {
  return (
    <section aria-labelledby="process-v4-heading" className={`v4-rise ${SECTION} relative isolate overflow-hidden border-t border-line bg-carbon`}>
      {/* Decorative: a generated scanline band, set as a horizon under the
          three steps and never under copy. Not a readout of anything. */}
      <div aria-hidden="true" className="v4-art v4-art-scan" />
      <div className={WRAP}>
        <SectionHead id="process-v4-heading" index={`${step} — How it works`} title="Three steps" />
        {/* Steps land one after another, left to right, and the numeral on each
            drops in last — the eye reads 01, 02, 03 in the order the shop works. */}
        <ol className="v4-stagger mt-8 grid gap-px overflow-hidden rounded-[3px] border border-line bg-line md:grid-cols-3">
          {STEPS.map((item, index) => (
            <li key={item.title} className="bg-carbon-2 p-6">
              <span className="v4-num v4-title v4-drop block text-4xl text-clover">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="v4-title mt-3 text-xl">{item.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-snug text-steel">{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
