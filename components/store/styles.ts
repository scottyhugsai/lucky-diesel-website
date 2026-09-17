/**
 * Shared class strings so store surfaces read right in both designs:
 * v1 "Garage" = sharp corners, v2 "Showroom" = big rounded tiles and pill controls.
 */
export const TILE = 'rounded-sm [[data-design=v2]_&]:rounded-3xl';
export const PILL = 'rounded-sm [[data-design=v2]_&]:rounded-full';
export const FIELD = 'rounded-sm [[data-design=v2]_&]:rounded-xl';
/** Section wrapper width and gutters, matching the rest of the site. */
export const WRAP = 'mx-auto max-w-7xl px-4 sm:px-6';
export const BTN_PRIMARY = `btn-go display inline-flex min-h-12 items-center justify-center gap-2 px-6 text-xl not-italic ${PILL} [[data-design=v2]_&]:text-base`;
export const BTN_GHOST = `inline-flex min-h-12 items-center justify-center gap-2 border border-chalk/20 px-5 font-semibold transition-colors hover:border-clover hover:text-clover ${PILL}`;
