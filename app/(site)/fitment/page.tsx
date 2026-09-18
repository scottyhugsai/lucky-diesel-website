import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarClock, CircleHelp, Wrench } from 'lucide-react';
import { TRUCK_ENDPOINT } from '@/components/store/TruckBar';
import { FitmentPicker } from '@/components/v4/FitmentPicker';
import { EmissionsNote, UseCaseTiers } from '@/components/v4/UseCaseTiers';
import { BTN_GHOST, BTN_PRIMARY, WRAP } from '@/components/v4/ui';
import { fitmentParams, parseFitment, resolveFitment } from '@/lib/fitment/select';
import { findUseCase } from '@/lib/fitment/use-cases';
import { BUSINESS, PLATFORMS } from '@/lib/site';
import { filterProducts, getStorefrontCatalog } from '@/lib/store/catalog';

interface FitmentPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The answer page. Every picker combination is a real URL, which makes the tool
 * shareable and back-button-friendly — but a parameterised page per truck would
 * be thousands of near-identical pages, which is what search engines call
 * scaled content. So these are noindex, and the canonical points at the
 * platform page that genuinely deserves to rank.
 */
export async function generateMetadata({ searchParams }: FitmentPageProps): Promise<Metadata> {
  const result = resolveFitment(parseFitment(await searchParams));
  const platform = result?.platform ? PLATFORMS.find((entry) => entry.id === result.platform) : null;
  const title = result
    ? `${result.label} — parts & tuning | ${BUSINESS.name}`
    : `What fits your truck | ${BUSINESS.name} ${BUSINESS.city}`;

  return {
    title,
    description: result
      ? `What Lucky Diesel can do for a ${result.label}, what it involves and where the price starts. ${BUSINESS.city}, ${BUSINESS.region}.`
      : `Pick your year, make, model and engine and see what actually fits. Diesel tuning, turbos and fuel in ${BUSINESS.city}, ${BUSINESS.region}.`,
    robots: { index: false, follow: true },
    alternates: { canonical: platform ? `/${platform.id}` : '/fitment' },
  };
}

export default async function FitmentPage({ searchParams }: FitmentPageProps) {
  const params = await searchParams;
  const fitment = parseFitment(params);
  const result = resolveFitment(fitment);
  const goalParam = params.goal;
  const goal = findUseCase(typeof goalParam === 'string' ? goalParam : null);

  const platform = result?.platform ? PLATFORMS.find((entry) => entry.id === result.platform) ?? null : null;
  let fits = 0;
  if (result?.supported) {
    const { products, ok } = await getStorefrontCatalog();
    if (ok) {
      fits = filterProducts(products, {
        platform: result.platform,
        generationCollection: result.generationCollection,
      }).length;
    }
  }


  return (
    <div className={`${WRAP} py-10 sm:py-14`}>
      <nav aria-label="Breadcrumb" className="text-sm text-steel">
        <Link href="/" className="inline-flex min-h-11 items-center hover:text-clover">Home</Link> <span aria-hidden="true">/</span>{' '}
        <span className="text-chalk/80">What fits</span>
      </nav>

      <h1 className="v4-title mt-4 text-[length:var(--text-display)]">
        {result ? result.truck.model : 'What fits your truck'}
      </h1>
      {result && <p className="v4-num mt-2 text-lg text-steel">{result.label}</p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-20">
          <FitmentPicker fitment={fitment} />
        </div>

        <div id="answer" className="scroll-mt-20">
          {!result && (
            <p className="rounded-[3px] border border-dashed border-line p-6 text-steel">
              Pick a year, make, model and engine and we will show you what we can do with it.
            </p>
          )}

          {result && !result.supported && (
            <section aria-labelledby="unsupported" className="v4-panel p-6">
              <h2 id="unsupported" className="v4-title flex items-center gap-3 text-2xl">
                <CircleHelp className="size-6 shrink-0 text-amber" aria-hidden="true" />
                Not one of ours
              </h2>
              <p className="mt-3 text-steel">
                We work on Duramax, Powerstroke and Cummins. A {result.engine.name} is outside what we tune and build,
                so we would rather say so than take the booking.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a href={BUSINESS.smsHref} className={BTN_PRIMARY}>Text us anyway</a>
                <Link href="/store/products" className={BTN_GHOST}>Browse the store</Link>
              </div>
            </section>
          )}

          {result?.supported && (
            <>
              <section aria-labelledby="fits-heading" className="v4-panel p-6">
                <h2 id="fits-heading" className="v4-title text-2xl">Good news</h2>
                <p className="mt-3 text-steel">
                  That is a <span className="font-semibold text-chalk">{platform?.name}</span>. We tune, build and repair them.
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-line bg-line sm:grid-cols-3">
                  <div className="bg-carbon-2 p-4">
                    <dd className="v4-num v4-title text-2xl text-clover sm:text-3xl">{fits}</dd>
                    <dt className="kicker mt-1">parts listed</dt>
                  </div>
                  <div className="bg-carbon-2 p-4">
                    <dd className="v4-num v4-title text-2xl sm:text-3xl">{result.generation.label}</dd>
                    <dt className="kicker mt-1">generation</dt>
                  </div>
                  <div className="col-span-2 bg-carbon-2 p-4 sm:col-span-1">
                    <dd className="v4-title text-xl">{result.engine.name}</dd>
                    <dt className="kicker mt-1">engine</dt>
                  </div>
                </dl>
                {/* Saving the truck here is what stops the store asking again. */}
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <form method="post" action={TRUCK_ENDPOINT} className="contents">
                    {[...fitmentParams(fitment).entries()].map(([key, value]) => (
                      <input key={key} type="hidden" name={key} value={value} />
                    ))}
                    <input type="hidden" name="to" value="/store/products" />
                    <button type="submit" className={BTN_PRIMARY}>
                      Shop parts that fit <ArrowRight className="size-4" aria-hidden="true" />
                    </button>
                  </form>
                  <Link href="/book" className={BTN_GHOST}>
                    <CalendarClock className="size-4" aria-hidden="true" /> Book it in
                  </Link>
                </div>
                <p className="mt-3 text-sm text-steel">We remember it while you shop.</p>
              </section>

              <section aria-labelledby="goal-heading" className="mt-8">
                <h2 id="goal-heading" className="v4-title text-3xl sm:text-4xl">What is it for?</h2>
                <p className="mt-2 max-w-xl text-steel">
                  Same truck, three different jobs. Each one says what it costs you and what it does not.
                </p>
                <div className="mt-6"><UseCaseTiers fitment={fitment} current={goal?.id ?? null} /></div>
                <EmissionsNote />
              </section>

              {goal && (
                <section aria-labelledby="plan-heading" className="v4-panel mt-8 p-6">
                  <h2 id="plan-heading" className="v4-title flex items-center gap-3 text-2xl">
                    <Wrench className="size-5 shrink-0 text-clover" aria-hidden="true" />
                    {goal.name} on a {result.truck.model}
                  </h2>
                  <p className="mt-3 max-w-2xl text-steel">{goal.consequence}</p>
                  <Link
                    href={`/?truck=${platform?.id ?? ''}&about=${encodeURIComponent(`${result.label} — ${goal.name}`)}#quote`}
                    className={`${BTN_PRIMARY} mt-6`}
                  >
                    Get this quoted <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
