import 'server-only';
import type { MediaChoice } from '@/components/admin/site/MediaField';
import type { BlockStatus } from '@/components/admin/site/BlockForm';
import { changedFields } from '@/lib/site-content/diff';
import type { BlockDef, BlockValues } from '@/lib/site-content/fields';
import { blockDef } from '@/lib/site-content/registry';
import { mergeValues } from '@/lib/site-content/validate';
import { createClient } from '@/lib/supabase/server';

/** Photos the site ships with, always offered alongside the owner's uploads. */
const SHIPPED: readonly MediaChoice[] = [
  { url: '/images/shop-card.jpg', title: 'Business card on an engine' },
  { url: '/images/build-l5p-purple.jpg', title: 'Purple L5P build' },
  { url: '/images/part-turbo.png', title: 'Turbocharger' },
  { url: '/images/part-injectors.png', title: 'Injectors' },
  { url: '/images/part-cp3.png', title: 'CP3 pump' },
  { url: '/images/logo.png', title: 'Lucky Diesel logo' },
];

export interface StoredBlock {
  key: string;
  design: string;
  draft: BlockValues;
  published: BlockValues | null;
}

export async function loadBlocks(): Promise<StoredBlock[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('site_blocks').select('key, design, draft, published');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    key: row.key,
    design: row.design,
    draft: (row.draft ?? {}) as BlockValues,
    published: (row.published ?? null) as BlockValues | null,
  }));
}

export async function loadLibrary(): Promise<MediaChoice[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('site_media').select('url, title').order('created_at', { ascending: false }).limit(60);
  return [...(data ?? []).map((row) => ({ url: row.url, title: row.title })), ...SHIPPED];
}

export function findStored(blocks: readonly StoredBlock[], key: string, design: string): StoredBlock | null {
  return blocks.find((block) => block.key === key && block.design === design) ?? null;
}

export function statusOf(def: BlockDef, stored: StoredBlock | null): BlockStatus {
  if (!stored) return 'shipped';
  if (changedFields(def, stored.published, stored.draft).length) return 'draft';
  return stored.published ? 'live' : 'shipped';
}

/** What the editor should show: the draft if there is one, else what is live, else the shipped copy. */
export function editorValues(def: BlockDef, stored: StoredBlock | null, design = 'all'): BlockValues {
  return mergeValues(def, stored?.draft ?? stored?.published ?? null, design);
}

export function countDrafts(blocks: readonly StoredBlock[]): number {
  return blocks.filter((block) => {
    const def = blockDef(block.key);
    return def ? changedFields(def, block.published, block.draft).length > 0 : false;
  }).length;
}
