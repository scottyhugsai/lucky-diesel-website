import type { BlockDef } from '../fields';

interface PageSeed {
  id: string;
  title: string;
  heading: string;
  intro: string;
  seoTitle: string;
  seoDescription: string;
}

/** Every public page the owner can retitle, plus its search-engine copy. */
export const PAGE_SEEDS: readonly PageSeed[] = [
  {
    id: 'book', title: 'Book',
    heading: 'Book your truck in', intro: 'Pick a day and time. We confirm by text.',
    seoTitle: 'Book Diesel Service Online | Lucky Diesel Charleston',
    seoDescription: 'Pick a day and time for tuning, diagnostics or repair on your Duramax, Powerstroke or Cummins. Charleston, SC.',
  },
  {
    id: 'store', title: 'Store',
    heading: 'Parts for your truck.', intro: 'Turbos, fuel systems, tuning and exhaust.',
    seoTitle: 'Diesel Performance Parts | Lucky Diesel Charleston',
    seoDescription: 'Turbos, injectors, CP3 pumps, tuning and exhaust for Duramax, Powerstroke and Cummins. Charleston, SC.',
  },
  {
    id: 'builds', title: 'Builds',
    heading: 'Builds & dyno numbers', intro: 'Real trucks we’ve built, with the numbers they made.',
    seoTitle: 'Diesel Builds & Dyno Results | Lucky Diesel Charleston',
    seoDescription: 'Before-and-after dyno numbers from Duramax, Powerstroke and Cummins builds in Charleston, SC.',
  },
  {
    id: 'gallery', title: 'Gallery',
    heading: 'Gallery', intro: 'Work from the shop floor.',
    seoTitle: 'Shop Gallery | Lucky Diesel Charleston',
    seoDescription: 'Photos of tuning, turbo and fuel-system work on diesel trucks in Charleston, SC.',
  },
  {
    id: 'fleet', title: 'Fleet',
    heading: 'Keep the trucks working', intro: 'Servicing and priority scheduling for work fleets.',
    seoTitle: 'Fleet Diesel Service | Lucky Diesel Charleston',
    seoDescription: 'Scheduled maintenance, repair and priority booking for diesel work fleets around Charleston, SC.',
  },
  {
    id: 'planner', title: 'Build planner',
    heading: 'Plan your build', intro: 'Answer a few questions. Get a parts plan for your truck.',
    seoTitle: 'Diesel Build Planner | Lucky Diesel Charleston',
    seoDescription: 'Tell us your truck and your goal, and get a parts plan built around it. Charleston, SC.',
  },
];

const pageBlock = (seed: PageSeed): BlockDef => ({
  key: `page.${seed.id}`,
  group: 'pages',
  title: seed.title,
  fields: [
    { kind: 'text', name: 'heading', label: 'Page heading', max: 60, maxWords: 6 },
    { kind: 'textarea', name: 'intro', label: 'Intro line', max: 240, maxWords: 40 },
  ],
  defaults: { heading: seed.heading, intro: seed.intro },
});

const seoBlock = (seed: PageSeed): BlockDef => ({
  key: `seo.${seed.id}`,
  group: 'seo',
  title: seed.title,
  fields: [
    { kind: 'text', name: 'title', label: 'Search title', max: 70, help: 'Google shows about 60 characters.' },
    { kind: 'textarea', name: 'description', label: 'Search description', max: 170, help: 'Google shows about 155 characters.' },
    { kind: 'image', name: 'ogImage', label: 'Share image', help: 'Shown when the page is posted on social. 1200×630 works best.' },
  ],
  defaults: { title: seed.seoTitle, description: seed.seoDescription, ogImage: '' },
});

export const PAGE_BLOCKS: readonly BlockDef[] = PAGE_SEEDS.map(pageBlock);

export const SEO_BLOCKS: readonly BlockDef[] = [
  {
    key: 'seo.home',
    group: 'seo',
    title: 'Home',
    fields: [
      { kind: 'text', name: 'title', label: 'Search title', max: 70 },
      { kind: 'textarea', name: 'description', label: 'Search description', max: 170 },
      { kind: 'image', name: 'ogImage', label: 'Share image' },
    ],
    defaults: {
      title: 'Lucky Diesel | Diesel Performance & Repair in Charleston, SC',
      description: 'Duramax, Powerstroke and Cummins tuning, turbos, fuel systems and repair in Charleston, SC. Book online.',
      ogImage: '',
    },
  },
  ...PAGE_SEEDS.map(seoBlock),
];
