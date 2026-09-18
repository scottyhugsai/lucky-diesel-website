import type { BlockValues } from '@/lib/site-content/fields';
import { str } from '@/lib/site-content/values';
import { EmissionsNote, UseCaseTiers } from '../UseCaseTiers';
import { SECTION, SectionHead, WRAP } from '../ui';

/**
 * The decision layer. Every parts retailer in this category can tell you what
 * fits; almost none help you choose between the things that fit. This is that.
 */
export function GoalsV4({ values, step }: { values: BlockValues; step: string }) {
  return (
    <section id="services" aria-labelledby="goals-heading" className={`v4-rise ${SECTION} scroll-mt-16 border-t border-line`}>
      <div className={WRAP}>
        <SectionHead
          id="goals-heading"
          index={`${step} — What’s it for?`}
          title={str(values, 'heading').split('\n').filter(Boolean).join(' ')}
          line={str(values, 'intro')}
        />
        <div className="mt-8"><UseCaseTiers /></div>
        <EmissionsNote />
      </div>
    </section>
  );
}
