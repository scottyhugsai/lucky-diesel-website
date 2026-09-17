/**
 * Planner class recipes. v1 "Garage" is sharp and condensed; the [data-design=v2]
 * variants turn the same markup into Showroom tiles and pills.
 */

export const SURFACE =
  'rounded-sm border border-line bg-carbon-2 [[data-design=v2]_&]:rounded-3xl [[data-design=v2]_&]:border-transparent [[data-design=v2]_&]:bg-gunmetal/60';

export const BTN_PRIMARY =
  'btn-go display inline-flex min-h-13 items-center justify-center gap-2 rounded-sm px-6 text-2xl not-italic disabled:cursor-not-allowed disabled:opacity-50 [[data-design=v2]_&]:min-h-12 [[data-design=v2]_&]:text-lg';

export const BTN_GHOST =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-line px-5 text-sm font-semibold text-chalk transition-colors hover:border-chalk/40 active:bg-gunmetal [[data-design=v2]_&]:rounded-full [[data-design=v2]_&]:border-chalk/15 [[data-design=v2]_&]:text-base [[data-design=v2]_&]:font-medium';

export const CHOICE_CARD = [
  'relative flex min-h-16 w-full cursor-pointer items-center gap-4 rounded-sm border border-line bg-carbon-2 px-4 py-3 text-left',
  'transition-[border-color,background-color,transform] duration-150 hover:border-chalk/35 active:scale-[0.99]',
  'has-[:checked]:border-clover has-[:checked]:bg-clover/10 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-clover',
  '[[data-design=v2]_&]:rounded-2xl [[data-design=v2]_&]:border-transparent [[data-design=v2]_&]:bg-gunmetal/60 [[data-design=v2]_&]:px-5',
  '[[data-design=v2]_&]:has-[:checked]:border-clover [[data-design=v2]_&]:has-[:checked]:bg-gunmetal',
].join(' ');

export const BADGE =
  'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider [[data-design=v2]_&]:rounded-full [[data-design=v2]_&]:text-xs [[data-design=v2]_&]:font-medium [[data-design=v2]_&]:normal-case [[data-design=v2]_&]:tracking-normal';

export const INPUT =
  'h-13 w-full rounded-sm border border-line bg-carbon px-4 text-base text-chalk placeholder:text-steel/60 transition-colors hover:border-chalk/30 focus:border-clover focus:outline-none focus:ring-2 focus:ring-clover/30 [[data-design=v2]_&]:rounded-xl';

/** Step enter animation: CSS @starting-style, skipped entirely for reduced motion. */
export const STEP_ENTER =
  'transition-[opacity,translate] duration-500 ease-[var(--ease-out-expo)] starting:translate-y-4 starting:opacity-0 motion-reduce:transition-none';
