import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/database.types';
import type { Viewer } from '@/lib/auth';
import type { BlockDef, BlockValues } from './fields';
import { describeChange } from './diff';

type Client = SupabaseClient<Database>;
type AuditAction = Database['public']['Tables']['site_audit_log']['Insert']['action'];
type AuditEntity = Database['public']['Tables']['site_audit_log']['Insert']['entity'];

export interface BlockRecord {
  draft: BlockValues;
  published: BlockValues | null;
  published_at: string | null;
  updated_at: string;
}

/** The stored row for one block, or null when it has never been touched. */
export async function readBlock(supabase: Client, key: string, design: string): Promise<BlockRecord | null> {
  const { data, error } = await supabase
    .from('site_blocks')
    .select('draft, published, published_at, updated_at')
    .eq('key', key)
    .eq('design', design)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    draft: (data.draft ?? {}) as BlockValues,
    published: (data.published ?? null) as BlockValues | null,
    published_at: data.published_at,
    updated_at: data.updated_at,
  };
}

export async function audit(
  supabase: Client,
  viewer: Viewer,
  entry: { action: AuditAction; entity: AuditEntity; entityKey: string; summary: string; before?: unknown; after?: unknown },
): Promise<void> {
  const { error } = await supabase.from('site_audit_log').insert({
    actor_id: viewer.userId,
    actor_email: viewer.profile.email,
    action: entry.action,
    entity: entry.entity,
    entity_key: entry.entityKey,
    summary: entry.summary.slice(0, 300),
    before: (entry.before ?? null) as never,
    after: (entry.after ?? null) as never,
  });
  // A lost audit line must not silently pass for a recorded one.
  if (error) throw new Error(`Saved, but the change could not be recorded: ${error.message}`);
}

/** Writes a new draft and records what moved. */
export async function saveDraft(supabase: Client, viewer: Viewer, def: BlockDef, design: string, values: BlockValues): Promise<void> {
  const existing = await readBlock(supabase, def.key, design);
  const { error } = await supabase
    .from('site_blocks')
    .upsert({ key: def.key, design, draft: values as never, updated_at: new Date().toISOString(), updated_by: viewer.userId }, { onConflict: 'key,design' });
  if (error) throw new Error(error.message);
  await audit(supabase, viewer, {
    action: 'save',
    entity: def.key.startsWith('product:') ? 'product' : 'block',
    entityKey: `${def.key}${design === 'all' ? '' : ` (${design})`}`,
    summary: describeChange(def, existing?.draft ?? null, values),
    before: existing?.draft ?? null,
    after: values,
  });
}

/** Copies draft over published. Returns false when there was nothing to publish. */
export async function publishBlock(supabase: Client, viewer: Viewer, def: BlockDef, design: string): Promise<boolean> {
  const existing = await readBlock(supabase, def.key, design);
  if (!existing) return false;
  const summary = describeChange(def, existing.published, existing.draft);
  if (summary === 'No changes') return false;
  const { error } = await supabase
    .from('site_blocks')
    .update({ published: existing.draft as never, published_at: new Date().toISOString(), updated_by: viewer.userId })
    .eq('key', def.key)
    .eq('design', design);
  if (error) throw new Error(error.message);
  await audit(supabase, viewer, {
    action: 'publish',
    entity: def.key.startsWith('product:') ? 'product' : 'block',
    entityKey: `${def.key}${design === 'all' ? '' : ` (${design})`}`,
    summary,
    before: existing.published,
    after: existing.draft,
  });
  return true;
}

/** Throws away unpublished edits, restoring the live version. */
export async function discardDraft(supabase: Client, viewer: Viewer, def: BlockDef, design: string): Promise<void> {
  const existing = await readBlock(supabase, def.key, design);
  if (!existing) return;
  const query = existing.published
    ? supabase.from('site_blocks').update({ draft: existing.published as never }).eq('key', def.key).eq('design', design)
    : supabase.from('site_blocks').delete().eq('key', def.key).eq('design', design);
  const { error } = await query;
  if (error) throw new Error(error.message);
  await audit(supabase, viewer, {
    action: 'discard',
    entity: def.key.startsWith('product:') ? 'product' : 'block',
    entityKey: `${def.key}${design === 'all' ? '' : ` (${design})`}`,
    summary: `Unpublished edits thrown away: ${describeChange(def, existing.published, existing.draft)}`,
    before: existing.draft,
    after: existing.published,
  });
}

/** Removes the row so the site falls back to the copy it shipped with. */
export async function revertToShipped(supabase: Client, viewer: Viewer, def: BlockDef, design: string): Promise<void> {
  const existing = await readBlock(supabase, def.key, design);
  const { error } = await supabase.from('site_blocks').delete().eq('key', def.key).eq('design', design);
  if (error) throw new Error(error.message);
  await audit(supabase, viewer, {
    action: 'revert',
    entity: def.key.startsWith('product:') ? 'product' : 'block',
    entityKey: `${def.key}${design === 'all' ? '' : ` (${design})`}`,
    summary: 'Reset to the built-in copy',
    before: existing?.published ?? null,
    after: null,
  });
}
