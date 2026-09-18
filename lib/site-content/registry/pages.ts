import { BUSINESS } from '@/lib/site';
import type { BlockDef, Field } from '../fields';

interface PageSeed {
  id: string;
  title: string;
  /** Pages whose heading is rendered per-step (the planner) have no copy block. */
  editableCopy: boolean;
  kicker: string;
  heading: string;
  intro: string;
  seoTitle: string;
  seoDescription: string;
}

/** Every public page the owner can retitle, plus its search-engine copy.
 *  Defaults mirror the copy the site ships with, so the editor never shows
 *  wording that differs from what is on the page. */
export const PAGE_SEEDS: readonly PageSeed[] = [
  {
    id: 'book', title: 'Book', editableCopy: true,
    kicker: 'Book online',
    heading: 'Pick a time.\nWe’ll handle the rest.',
    intro: 'Choose a day and time that works. You’ll get a confirmation right away and a reminder before your appointment.',
    seoTitle: `Book Diesel Service Online | Lucky Diesel ${BUSINESS.city}`,
    seoDescription: `Pick a day and time for tuning, diagnostics or repair on your Duramax, Powerstroke or Cummins. ${BUSINESS.city}, ${BUSINESS.region}.`,
  },
  {
    id: 'store', title: 'Store', editableCopy: true,
    kicker: 'Lucky Diesel parts store',
    heading: 'Parts for your truck.',
    intro: 'Turbos, fuel and tunes we run in our own bays. Ships fast, or we install it.',
    seoTitle: `Diesel Performance Parts | ${BUSINESS.name} Store`,
    seoDescription: `Turbos, injectors, CP3s and tunes for Duramax, Powerstroke and Cummins. Shipped or installed in ${BUSINESS.city}, ${BUSINESS.region}.`,
  },
  {
    id: 'builds', title: 'Builds', editableCopy: true,
    kicker: 'From the shop',
    heading: 'Builds & dyno numbers',
    intro: 'Real trucks, the parts that went on them, and what they made on the dyno before and after.',
    seoTitle: `Diesel Builds & Dyno Results | Lucky Diesel ${BUSINESS.city}`,
    seoDescription: 'Duramax, Powerstroke and Cummins builds from the shop, with before-and-after dyno numbers and the parts that got them there.',
  },
  {
    id: 'gallery', title: 'Gallery', editableCopy: true,
    kicker: 'Straight off the shop floor',
    heading: 'Gallery',
    intro: 'Trucks we’ve built, parts we trust, days on the dyno.',
    seoTitle: `Gallery | Lucky Diesel ${BUSINESS.city}`,
    seoDescription: `Duramax, Powerstroke and Cummins trucks, parts and dyno days from the Lucky Diesel shop in ${BUSINESS.city}, ${BUSINESS.region}.`,
  },
  {
    id: 'fleet', title: 'Fleet', editableCopy: true,
    kicker: 'Fleet & B2B',
    heading: 'Keep the trucks working',
    intro: `Diesel PM, diagnostics and repair for work trucks around ${BUSINESS.city}. One shop, one invoice, one schedule.`,
    seoTitle: `Fleet service | ${BUSINESS.name}`,
    seoDescription: `Preventive maintenance, priority bays and net terms for work trucks in ${BUSINESS.city}, ${BUSINESS.region}.`,
  },
  {
    id: 'planner', title: 'Build planner', editableCopy: false,
    kicker: '', heading: '', intro: '',
    seoTitle: `Diesel Build Planner | Lucky Diesel ${BUSINESS.city}`,
    seoDescription: 'Pick your truck and goal. Get a staged Duramax, Powerstroke or Cummins build from parts that fit.',
  },
];

const PAGE_FIELDS = [
  { kind: 'text', name: 'kicker', label: 'Small line above', max: 40, maxWords: 5 },
  { kind: 'textarea', name: 'heading', label: 'Page heading', max: 70, maxWords: 6, help: 'A second line is shown in the accent colour.' },
  { kind: 'textarea', name: 'intro', label: 'Intro line', max: 240, maxWords: 40 },
] as const satisfies readonly Field[];

const SEO_FIELDS = [
  { kind: 'text', name: 'title', label: 'Search title', max: 70, help: 'Google shows about 60 characters.' },
  { kind: 'textarea', name: 'description', label: 'Search description', max: 170, help: 'Google shows about 155 characters.' },
  { kind: 'image', name: 'ogImage', label: 'Share image', help: 'Shown when the page is posted on social. 1200×630 works best.' },
] as const satisfies readonly Field[];

export const PAGE_BLOCKS: readonly BlockDef[] = PAGE_SEEDS.filter((seed) => seed.editableCopy).map((seed) => ({
  key: `page.${seed.id}`,
  group: 'pages',
  title: seed.title,
  fields: PAGE_FIELDS,
  defaults: { kicker: seed.kicker, heading: seed.heading, intro: seed.intro },
}));

export const SEO_BLOCKS: readonly BlockDef[] = [
  {
    key: 'seo.home',
    group: 'seo',
    title: 'Home',
    fields: SEO_FIELDS,
    defaults: {
      title: `Lucky Diesel | Diesel Performance, Tuning & Repair in ${BUSINESS.city}, ${BUSINESS.region}`,
      description: `Duramax, Powerstroke and Cummins performance tuning, parts and repair in ${BUSINESS.city}, ${BUSINESS.region}. Request service online or call ${BUSINESS.phoneDisplay}.`,
      ogImage: '',
    },
  },
  ...PAGE_SEEDS.map((seed) => ({
    key: `seo.${seed.id}`,
    group: 'seo' as const,
    title: seed.title,
    fields: SEO_FIELDS,
    defaults: { title: seed.seoTitle, description: seed.seoDescription, ogImage: '' },
  })),
];
