import 'server-only';
import { createClient } from '@/lib/supabase/server';

const SIGNED_URL_SECONDS = 60 * 60;

/** Short-lived signed URLs for private media, respecting the viewer's storage policies. */
export async function signedMediaUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('media').createSignedUrls(unique, SIGNED_URL_SECONDS);
  if (error) {
    console.error(`[media] signing failed: ${error.message}`);
    return {};
  }
  const entries: [string, string][] = [];
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) entries.push([item.path, item.signedUrl]);
  }
  return Object.fromEntries(entries);
}
