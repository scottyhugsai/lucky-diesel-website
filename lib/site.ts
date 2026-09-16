/**
 * Every business fact on the site lives here. Sourced from luckydiesel.com
 * (contact policy page, service-request form, product catalog) on 2026-09-16.
 * Do not add claims — years in business, reviews, address, hours — until the
 * owner supplies them.
 */

export const BUSINESS = {
  name: 'Lucky Diesel',
  legalName: 'Lucky Diesel LLC',
  phoneDisplay: '(843) 995-9252',
  phoneHref: 'tel:+18439959252',
  smsHref: 'sms:+18439959252',
  email: 'service@luckydiesel.com',
  store: 'https://luckydiesel.com',
  /** From the Instagram bio. Street address and hours: pending from owner. */
  city: 'Charleston',
  region: 'SC',
  areaServed: ['Charleston', 'North Charleston', 'Mount Pleasant', 'Summerville', 'Goose Creek', 'Awendaw'],
  social: {
    instagram: 'https://www.instagram.com/luckydieselllc/',
    facebook: 'https://www.facebook.com/people/Lucky-Diesel/61588373641534/',
    tiktok: 'https://www.tiktok.com/@luckydieselllc',
  },
} as const;

export interface Platform {
  id: 'duramax' | 'powerstroke' | 'cummins';
  name: string;
  make: string;
  tagline: string;
  /** Shopify collection handle for the whole platform. */
  collection: string;
  generations: readonly string[];
  /** Shopify collection handle per generation, same order as `generations`. */
  generationCollections: readonly string[];
}

export const PLATFORMS: readonly Platform[] = [
  {
    id: 'duramax',
    name: 'Duramax',
    make: 'Chevy / GMC',
    tagline: 'LB7 to L5P. Turbos, CP3s, injectors and tunes for every 6.6L.',
    collection: 'duramax',
    generationCollections: [
      'duramax-2001-2004-lb7',
      'duramax-2004-5-2005-lly',
      'duramax-2006-2007-lbz',
      'duramax-2007-5-2010-lmm',
      'duramax-2011-2016-lml',
      'duramax-2017-present-l5p',
    ],
    generations: [
      '2001–2004 LB7 6.6L',
      '2004.5–2005 LLY 6.6L',
      '2006–2007 LBZ 6.6L',
      '2007.5–2010 LMM 6.6L',
      '2011–2016 LML 6.6L',
      '2017–Present L5P 6.6L',
    ],
  },
  {
    id: 'powerstroke',
    name: 'Powerstroke',
    make: 'Ford',
    tagline: 'From the 7.3L to the newest 6.7L. Engine and 10R140 transmission tuning.',
    collection: 'powerstroke',
    generationCollections: [
      'powerstroke-1994-5-2003-7-3l',
      'powerstroke-2003-2007-6-0l',
      'powerstroke-2008-2010-6-4l',
      'powerstroke-2011-2019-6-7l',
      'powerstroke-2020-2022-6-7l',
      'powerstroke-2023-present-6-7l',
    ],
    generations: [
      '1994.5–2003 7.3L',
      '2003–2007 6.0L',
      '2008–2010 6.4L',
      '2011–2019 6.7L',
      '2020–2022 6.7L',
      '2023–Present 6.7L',
    ],
  },
  {
    id: 'cummins',
    name: 'Cummins',
    make: 'Dodge / Ram',
    tagline: '12-valves, 24-valves and common rail. Built to pull, built to last.',
    collection: 'cummins',
    generationCollections: [
      'cummins-1989-1993-5-9l-12v',
      'cummins-1994-1998-5-5-9l-12v',
      'cummins-1998-5-2002-5-9l-24v',
      'cummins-2003-2007-5-9l-common-rail',
      'cummins-2007-5-2012-6-7l',
      'cummins-2013-2018-6-7l',
      'cummins-2019-present-6-7l',
    ],
    generations: [
      '1989–1993 5.9L 12V',
      '1994–1998.5 5.9L 12V',
      '1998.5–2002 5.9L 24V',
      '2003–2007 5.9L Common Rail',
      '2007.5–2012 6.7L',
      '2013–2018 6.7L',
      '2019–Present 6.7L',
    ],
  },
];

export const OTHER_PLATFORM = 'other' as const;

export interface Service {
  id: string;
  name: string;
  blurb: string;
  /** Lowest current parts price on the Shopify store, where one applies. Labor not included. */
  partsFrom?: number;
}

/** Same service list, same order, as the owner's existing request form. */
export const SERVICES: readonly Service[] = [
  { id: 'tuning', name: 'Performance tuning', blurb: 'EZ-Lynk engine and transmission tunes, dialed to your build.', partsFrom: 444 },
  { id: 'diagnostics', name: 'Diagnostics', blurb: 'Find the real fault before a single part gets thrown at it.' },
  { id: 'turbo', name: 'Turbocharger', blurb: 'Stock replacements to Stage 2 upgrades, supplied and installed.', partsFrom: 1695 },
  { id: 'fuel', name: 'Fuel system', blurb: 'Injectors, CP3 pumps and conversion kits.', partsFrom: 600 },
  { id: 'exhaust', name: 'Exhaust system', blurb: '5" stainless systems for Powerstroke and L5P.', partsFrom: 650 },
  { id: 'transmission', name: 'Transmission', blurb: 'Shift tuning and repair to handle the extra power.' },
  { id: 'engine', name: 'Engine repair / build', blurb: 'From fixing what broke to building what’s next.' },
  { id: 'maintenance', name: 'Maintenance', blurb: 'Keep a working truck working.' },
  { id: 'install', name: 'Parts installation', blurb: 'Bought the parts? We’ll put them on right.' },
];

export const OTHER_SERVICE = 'other' as const;

export interface PartLine {
  title: string;
  brand: string;
  image: string;
  href: string;
}

export const PART_LINES: readonly PartLine[] = [
  {
    title: 'Turbochargers',
    brand: 'Dan’s Diesel Performance',
    image: '/images/part-turbo.png',
    href: `${BUSINESS.store}/collections/parts`,
  },
  {
    title: 'Performance injectors',
    brand: 'Dan’s Diesel Performance',
    image: '/images/part-injectors.png',
    href: `${BUSINESS.store}/collections/parts`,
  },
  {
    title: 'CP3 pumps & kits',
    brand: 'Dan’s Diesel Performance',
    image: '/images/part-cp3.png',
    href: `${BUSINESS.store}/collections/parts`,
  },
];

export const TUNING_BRANDS = ['EZ-Lynk', 'ASAP Calibrations', 'AMDP'] as const;
