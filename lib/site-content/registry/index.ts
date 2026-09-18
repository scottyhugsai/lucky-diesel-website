import type { BlockDef, BlockGroup } from '../fields';
import { HOME_BLOCKS } from './home';
import { NAV_BLOCKS, PLATFORM_BLOCKS } from './nav';
import { PAGE_BLOCKS, SEO_BLOCKS } from './pages';
import { PRODUCT_KEY_PREFIX, productBlockDef } from './products';

export * from './home';
export * from './nav';
export * from './pages';
export * from './products';

/** Every editable block on the site. Order here is the order in the admin. */
export const BLOCKS: readonly BlockDef[] = [...HOME_BLOCKS, ...PAGE_BLOCKS, ...PLATFORM_BLOCKS, ...NAV_BLOCKS, ...SEO_BLOCKS];

const BY_KEY = new Map(BLOCKS.map((block) => [block.key, block]));

export function blockDef(key: string): BlockDef | null {
  if (key.startsWith(PRODUCT_KEY_PREFIX)) {
    const handle = key.slice(PRODUCT_KEY_PREFIX.length);
    return /^[a-z0-9][a-z0-9-]{0,118}$/.test(handle) ? productBlockDef(handle) : null;
  }
  return BY_KEY.get(key) ?? null;
}

export const GROUPS: readonly { id: BlockGroup; label: string; blurb: string }[] = [
  { id: 'announcement', label: 'Announcement', blurb: 'The bar across the top of the site.' },
  { id: 'home', label: 'Home page', blurb: 'Hero, section order and section copy.' },
  { id: 'pages', label: 'Pages', blurb: 'Headings and intros for each page.' },
  { id: 'platforms', label: 'Truck pages', blurb: 'Duramax, Powerstroke and Cummins.' },
  { id: 'nav', label: 'Navigation', blurb: 'What appears in the menu, and what it is called.' },
  { id: 'seo', label: 'Search & sharing', blurb: 'Titles, descriptions and share images.' },
];

export function blocksInGroup(group: BlockGroup): readonly BlockDef[] {
  return BLOCKS.filter((block) => block.group === group);
}
