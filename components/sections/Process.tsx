import { Reveal } from '@/components/ui/Reveal';

const STEPS = [
  { title: 'Tell us about your truck', body: 'Engine, mileage and what you want out of it. Takes a minute.' },
  { title: 'We reach out with a plan', body: 'A straight answer on parts, tuning and what it’ll take.' },
  { title: 'Get it done right', body: 'Bring it in and drive out with it sorted.' },
] as const;

export function Process() {
  return (
    <section aria-labelledby="process-heading" className="border-t border-line py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="kicker">How it works</p>
          <h2 id="process-heading" className="display mt-3 text-[length:var(--text-display)]">
            Three steps. No runaround.
          </h2>
        </Reveal>

        <div className="relative mt-14">
          <div aria-hidden="true" className="speed-stripes absolute left-0 right-0 top-[2.1rem] hidden h-1.5 opacity-40 md:block" />
          <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, index) => (
            <Reveal as="li" key={step.title} delayMs={index * 140} className="relative">
              <span className="display relative inline-grid size-[4.25rem] place-items-center bg-carbon text-6xl text-clover">
                {index + 1}
              </span>
              <h3 className="display mt-5 text-4xl not-italic">{step.title}</h3>
              <p className="mt-2 max-w-xs text-chalk/65">{step.body}</p>
            </Reveal>
          ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
