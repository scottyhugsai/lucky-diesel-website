import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getViewer } from '@/lib/auth';
import { type Design, getDesign } from '@/lib/design';
import { createClient } from '@/lib/supabase/server';
import type { BlockValues } from './fields';
import { PRODUCT_KEY_PREFIX, blockDef, toProductOverride, type ProductOverride } from './registry';
import { mergeValues } from './validate';

export const PREVIEW_COOKIE = 'ld_preview';

/** True only for a signed-in admin who turned preview on. The cookie alone proves nothing. */
export const isPreviewing = cache(async (): Promise<boolean> => {
  if ((await cookies()).get(PREVIEW_COOKIE)?.value !== '1') return false;
  const viewer = await getViewer();
  return viewer?.profile.role === 'admin';
});

interface BlockRow {
  key: string;
  design: string;
  published: BlockValues | null;
  draft?: BlockValues | null;
}

export interface SiteContent {
  /** Merged over the shipped defaults, so a page never renders blank. */
  block: (key: string) => BlockValues;
  product: (handle: string) => ProductOverride;
  productHandles: readonly string[];
  design: Design;
  preview: boolean;
}

function pick(rows: readonly BlockRow[], design: Design, preview: boolean): Map<string, BlockValues> {
  const values = new Map<string, BlockValues>();
  // 'all' first, then the design-specific row overwrites it.
  for (const scope of ['all', design]) {
    for (const row of rows) {
      if (row.design !== scope) continue;
      const stored = preview ? (row.draft ?? row.published) : row.published;
      if (stored) values.set(row.key, stored);
    }
  }
  return values;
}

/** Everything the public site needs to render, in one query per request. */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  const [design, preview] = await Promise.all([getDesign(), isPreviewing()]);
  const supabase = await createClient();
  const columns = preview ? 'key, design, published, draft' : 'key, design, published';
  const { data, error } = await supabase.from('site_blocks').select(columns).in('design', ['all', design]);
  if (error) console.error(`[site-content] ${error.message}`);
  const stored = pick((data ?? []) as unknown as BlockRow[], design, preview);

  const productHandles = [...stored.keys()]
    .filter((key) => key.startsWith(PRODUCT_KEY_PREFIX))
    .map((key) => key.slice(PRODUCT_KEY_PREFIX.length));

  return {
    design,
    preview,
    productHandles,
    block(key) {
      const def = blockDef(key);
      if (!def) throw new Error(`[site-content] unknown block "${key}"`);
      return mergeValues(def, stored.get(key) ?? null, design);
    },
    product(handle) {
      return toProductOverride({ ...(stored.get(`${PRODUCT_KEY_PREFIX}${handle}`) ?? {}) });
    },
  };
});
