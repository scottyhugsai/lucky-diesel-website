import { BUSINESS } from '@/lib/site';
import type { BlockDef, Field } from '../fields';

/** Homepage section ids. Every design maps its own components onto these, so the
 *  owner orders the homepage once and all designs follow. */
export const HOME_SECTIONS = [
  { value: 'hero', label: 'Hero' },
  { value: 'platforms', label: 'Pick your truck' },
  { value: 'services', label: 'Services' },
  { value: 'builds', label: 'Featured build' },
  { value: 'parts', label: 'Parts' },
  { value: 'process', label: 'How it works' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'quote', label: 'Request service' },
] as const;

export const HOME_SECTION_IDS = HOME_SECTIONS.map((section) => section.value);
export type HomeSectionId = (typeof HOME_SECTIONS)[number]['value'];

/** Every homepage band reads the same way: a small line, a heading, an intro. */
const SECTION_FIELDS = [
  { kind: 'text', name: 'kicker', label: 'Small line above', max: 40, maxWords: 4 },
  { kind: 'textarea', name: 'heading', label: 'Heading', max: 70, maxWords: 6, help: 'A second line is shown in a lighter colour.' },
  { kind: 'textarea', name: 'intro', label: 'Intro', max: 240, maxWords: 40 },
] as const satisfies readonly Field[];

export const HOME_BLOCKS: readonly BlockDef[] = [
  {
    key: 'announcement',
    group: 'announcement',
    title: 'Announcement bar',
    description: 'A single line across the top of every page. Leave it off unless you have something to say.',
    fields: [
      { kind: 'boolean', name: 'enabled', label: 'Show the bar' },
      { kind: 'text', name: 'text', label: 'Message', max: 90, maxWords: 12, help: 'Keep it to one short line.' },
      { kind: 'text', name: 'linkLabel', label: 'Button label', max: 24, maxWords: 3 },
      { kind: 'url', name: 'href', label: 'Button link', max: 200, help: 'A page on this site, like /offers.' },
      { kind: 'select', name: 'tone', label: 'Style', options: [{ value: 'info', label: 'Plain' }, { value: 'offer', label: 'Highlighted' }] },
    ],
    defaults: { enabled: false, text: '', linkLabel: '', href: '', tone: 'info' },
  },
  {
    key: 'home.hero',
    group: 'home',
    title: 'Hero',
    description: 'The first thing anyone sees.',
    fields: [
      { kind: 'text', name: 'eyebrow', label: 'Small line above', max: 60, maxWords: 8 },
      { kind: 'textarea', name: 'headline', label: 'Headline', max: 90, maxWords: 6, help: 'One line per line — up to three.' },
      { kind: 'textarea', name: 'subhead', label: 'Sub-headline', max: 240, maxWords: 40 },
      { kind: 'text', name: 'primaryLabel', label: 'Main button', max: 24, maxWords: 3 },
      { kind: 'url', name: 'primaryHref', label: 'Main button link', max: 200 },
      { kind: 'text', name: 'badge', label: 'Photo badge', max: 40, maxWords: 6 },
      { kind: 'image', name: 'image', label: 'Hero photo' },
      { kind: 'text', name: 'imageAlt', label: 'Photo description', max: 140, help: 'Read aloud by screen readers.' },
    ],
    defaults: {
      eyebrow: 'Diesel performance · Charleston, SC',
      headline: 'Built to\nlay a\nheater.',
      subhead: 'Duramax, Powerstroke and Cummins tuning, parts and repair in Charleston. Tell us what you drive, and we’ll tell you what it takes.',
      primaryLabel: 'Request service',
      primaryHref: '/#quote',
      badge: 'EZ-Lynk tuning & DDP parts',
      image: '/images/shop-card.jpg',
      imageAlt: 'A Lucky Diesel business card propped on a diesel engine',
    },
    designDefaults: {
      v2: {
        headline: 'Built to lay a heater.',
        subhead: `Duramax, Powerstroke and Cummins. Tuned, built and repaired in ${BUSINESS.city}.`,
        primaryLabel: 'Book now',
        primaryHref: '/book',
        image: '/images/build-l5p-purple.jpg',
        imageAlt: 'Purple-piped L5P Duramax engine bay built at Lucky Diesel',
        badge: 'L5P Duramax. Built and tuned in-house.',
      },
      v3: {
        eyebrow: `${BUSINESS.city}, ${BUSINESS.region} · Diesel performance`,
        headline: 'Tuned. Built. Dyno-proven.',
        subhead: 'Duramax, Powerstroke and Cummins tuning, parts and repair. Pick your truck to start.',
        image: '/images/build-l5p-purple.jpg',
        imageAlt: '',
      },
      v4: {
        eyebrow: `Diesel performance — ${BUSINESS.city}, ${BUSINESS.region}`,
        headline: 'What are you\nrunning?',
        subhead: 'Tell us the truck and what it is for. We will tell you what fits and what it costs.',
        primaryLabel: 'Book a slot',
        primaryHref: '/book',
      },
    },
  },
  {
    key: 'home.sections',
    group: 'home',
    title: 'Homepage order',
    description: 'Use the arrows to reorder. Remove a section to hide it everywhere.',
    fields: [{ kind: 'list', name: 'order', label: 'Sections', options: HOME_SECTIONS, min: 2 }],
    defaults: { order: HOME_SECTION_IDS },
  },
  {
    key: 'home.services',
    group: 'home',
    title: 'Services section',
    fields: SECTION_FIELDS,
    defaults: {
      kicker: 'What we do',
      heading: 'More power.\nLess guessing.',
      intro: 'One shop for the tune, the parts and the install. Tap a service to start a request.',
    },
    designDefaults: {
      v2: { kicker: '', heading: 'Why Lucky.', intro: 'Nine ways we keep diesels working hard.' },
      v3: { kicker: '02 / SERVICES', heading: 'What we do', intro: 'Parts pricing is live. Labor is quoted per truck.' },
      v4: { kicker: '', heading: 'Three ways in', intro: 'Pick the one that matches your truck. Each says plainly what it costs you and what it does not.' },
    },
  },
  {
    key: 'home.parts',
    group: 'home',
    title: 'Parts section',
    fields: SECTION_FIELDS,
    defaults: {
      kicker: 'Parts & tuning',
      heading: 'The good stuff, in stock.',
      intro: '',
    },
    designDefaults: {
      v2: { kicker: '', heading: 'Featured parts.', intro: 'Real inventory. Ships from the store.' },
      v3: { kicker: '04 / PARTS', heading: 'Parts we run', intro: 'Shipped fast, or installed here.' },
      v4: { kicker: '', heading: 'Parts we run', intro: 'Shipped fast, or installed here.' },
    },
  },
  {
    key: 'home.quote',
    group: 'home',
    title: 'Request-service section',
    fields: SECTION_FIELDS,
    defaults: {
      kicker: 'Request service',
      heading: 'Tell us about\nyour truck.',
      intro: 'The more detail you give, the faster we can point you in the right direction.',
    },
  },
];
