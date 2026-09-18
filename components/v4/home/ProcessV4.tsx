import { SECTION, SectionHead, WRAP } from '../ui';

const STEPS = [
  { title: 'Tell us the truck', body: 'Engine, mileage, what you want out of it.' },
  { title: 'We come back with a plan', body: 'Straight answer on parts, tuning and cost.' },
  { title: 'Bring it in', body: 'Drive out with it sorted.' },
] as const;

/** Three steps on a hairline, numbered as data. */
export function ProcessV4() {
  return (
    <section aria-labelledby="process-v4-heading" className={SECTION}>
      <div className={WRAP}>
        <SectionHead id="process-v4-heading" index="05 — How it works" title="Three steps." />
        <ol className="mt-9 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="bg-carbon-2 p-6">
              <span className="v4-num block text-sm text-clover">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="v4-title mt-3 text-xl">{step.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-snug text-steel">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
