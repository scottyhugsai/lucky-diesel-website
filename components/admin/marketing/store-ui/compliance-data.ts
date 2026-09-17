import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCatalog } from '@/lib/store/catalog';
import { complianceFor } from '@/lib/store/compliance';
import { loadComplianceMap } from '@/lib/store/compliance-service';
import type { ComplianceItem } from './CompliancePanel';

const MAX_ITEMS = 120;

/**
 * SKUs that need a compliance tag: anything defaulting to unverified plus
 * anything the owner already tagged. Unverified first, so the work is on top.
 */
export async function loadCompliance(): Promise<{ items: ComplianceItem[]; unverified: number; catalogOk: boolean }> {
  const [{ products, ok }, map] = await Promise.all([getCatalog(), loadComplianceMap(createAdminClient())]);
  if (!ok) return { items: [], unverified: 0, catalogOk: false };

  const { data: notes } = await createAdminClient().from('sku_compliance').select('handle, note').limit(5000);
  const noteByHandle = new Map((notes ?? []).map((row) => [row.handle, row.note]));

  const relevant = products.flatMap((product) => {
    const status = complianceFor(product, map);
    const tagged = map.has(product.handle);
    if (status === 'not_applicable' && !tagged) return [];
    return [{
      handle: product.handle,
      title: product.title,
      status,
      eoNumber: map.get(product.handle)?.eoNumber ?? null,
      note: noteByHandle.get(product.handle) ?? null,
      offRoadOnly: product.offRoadOnly,
    }];
  });

  const unverified = relevant.filter((item) => item.status === 'unverified').length;
  const items = relevant
    .sort((a, b) => Number(b.status === 'unverified') - Number(a.status === 'unverified') || a.title.localeCompare(b.title))
    .slice(0, MAX_ITEMS);
  return { items, unverified, catalogOk: true };
}
