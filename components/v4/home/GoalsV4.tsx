import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { BlockValues } from '@/lib/site-content/fields';
import { str } from '@/lib/site-content/values';
import { UseCaseLadder } from './UseCaseLadder';
import { SECTION, SectionHead, WRAP } from '../ui';

/**
 * The decision layer. Every parts retailer in this category can tell you what
 * fits; almost none help you choose between the things that fit. This is that.
 */
export function GoalsV4({ values }: { values: BlockValues }) {
  return (
    <section id="services" aria-labelledby="goals-heading" className={`v4-rise ${SECTION} relative isolate scroll-mt-16 overflow-hidden border-t border-line bg-carbon`}>
      {/* Decorative: a generated flow-field, placed in the empty right of the
          head row from 1024px up. Not a photograph of anything. */}
      <div aria-hidden="true" className="v4-art v4-art-flow" />
      <div className={WRAP}>
        <SectionHead
          id="goals-heading"
          index="What’s it for?"
          title={str(values, 'heading').split('\n').filter(Boolean).join(' ')}
          line={str(values, 'intro')}
        />
        <UseCaseLadder />
        {/* Each row already states it, so this is the link, not the claim again. */}
        <Link href="/emissions-policy" className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-chalk underline underline-offset-4 hover:text-clover">
          Where we stand on emissions <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
