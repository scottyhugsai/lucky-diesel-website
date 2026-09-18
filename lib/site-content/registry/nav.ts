import { BUSINESS, PLATFORMS } from '@/lib/site';
import type { BlockDef, Field } from '../fields';

/** Everywhere the primary nav is allowed to point. Hrefs are fixed in code; the
 *  owner controls which five appear and what they are called. */
export const NAV_DESTINATIONS = [
  { value: 'fitment', label: 'What fits', href: '/fitment' },
  { value: 'book', label: 'Book', href: '/book' },
  { value: 'store', label: 'Store', href: '/store' },
  { value: 'planner', label: 'Plan', href: '/build-planner' },
  { value: 'builds', label: 'Builds', href: '/builds' },
  { value: 'gallery', label: 'Gallery', href: '/gallery' },
  { value: 'services', label: 'Services', href: '/#services' },
  { value: 'fleet', label: 'Fleet', href: '/fleet' },
  { value: 'offers', label: 'Offers', href: '/offers' },
  { value: 'events', label: 'Events', href: '/events' },
  { value: 'faq', label: 'FAQ', href: '/faq' },
] as const;

export type NavDestinationId = (typeof NAV_DESTINATIONS)[number]['value'];

/**
 * The five the site ships with. More than five and the nav stops being scannable.
 *
 * "What fits" leads because the truck picker is the idea the whole design is
 * built around, and it was reachable only from the footer. It takes the slot
 * Builds had: Builds is worth linking once there are real builds on it, and
 * until the owner supplies them every entry there is labelled an example.
 */
export const DEFAULT_NAV: readonly NavDestinationId[] = ['fitment', 'book', 'store', 'planner', 'gallery'];

const labelFields: Field[] = NAV_DESTINATIONS.map((destination) => ({
  kind: 'text',
  name: `label.${destination.value}`,
  label: `“${destination.label}” is called`,
  max: 16,
  maxWords: 2,
}));

const labelDefaults = Object.fromEntries(NAV_DESTINATIONS.map((d) => [`label.${d.value}`, d.label]));

export const NAV_BLOCKS: readonly BlockDef[] = [
  {
    key: 'nav.primary',
    group: 'nav',
    title: 'Main navigation',
    description: 'Five destinations at most. The rest move into the More menu.',
    fields: [
      { kind: 'list', name: 'items', label: 'Menu', options: NAV_DESTINATIONS.map(({ value, label }) => ({ value, label })), min: 2, max: 5 },
      ...labelFields,
    ],
    defaults: { items: DEFAULT_NAV, ...labelDefaults },
  },
];

export const PLATFORM_BLOCKS: readonly BlockDef[] = PLATFORMS.map((platform) => ({
  key: `platform.${platform.id}`,
  group: 'platforms',
  title: platform.name,
  description: `${platform.make} · /${platform.id}`,
  fields: [
    { kind: 'text', name: 'kicker', label: 'Small line above', max: 60, maxWords: 8 },
    { kind: 'text', name: 'heading', label: 'Page heading', max: 60, maxWords: 6 },
    { kind: 'textarea', name: 'intro', label: 'Intro line', max: 240, maxWords: 40 },
  ],
  defaults: { kicker: `${platform.make} · ${BUSINESS.city}, ${BUSINESS.region}`, heading: platform.name, intro: platform.tagline },
}));
