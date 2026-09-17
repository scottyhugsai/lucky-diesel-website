import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { isComplianceStatus, isPromotable, type ComplianceMap, type ComplianceProduct, type ComplianceRecord } from './compliance';

type Db = ReturnType<typeof createAdminClient>;

/** Owner-set SKU compliance tags. An unreadable table means nothing is verified (fail closed). */
export async function loadComplianceMap(db: Db = createAdminClient()): Promise<ComplianceMap> {
  const { data, error } = await db.from('sku_compliance').select('handle, status, eo_number').limit(5000);
  if (error) console.error(`[store] compliance tags unavailable: ${error.message}`);
  const map = new Map<string, ComplianceRecord>();
  for (const row of data ?? []) if (isComplianceStatus(row.status)) map.set(row.handle, { status: row.status, eoNumber: row.eo_number });
  return map;
}

/** Products safe for promos, ads, social drafts and feeds. */
export async function filterPromotable<T extends ComplianceProduct>(products: readonly T[], db?: Db): Promise<T[]> {
  const map = await loadComplianceMap(db);
  return products.filter((p) => isPromotable(p, map));
}
