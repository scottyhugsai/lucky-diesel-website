'use server';

import { revalidatePath } from 'next/cache';
import { guard, oneOf, requiredText, text, type ActionState } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { COMPLIANCE_STATUSES, normalizeEoNumber } from '@/lib/store/compliance';
import { createAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/marketing/settings';
const HANDLE = /^[a-z0-9][a-z0-9-]{0,254}$/;

/** Tags one SKU. Untagged emissions parts stay unverified, so they stay out of promos and feeds. */
export async function setSkuCompliance(_prev: ActionState, form: FormData): Promise<ActionState> {
  const viewer = await requireRole('admin');
  return guard(async () => {
    const handle = requiredText(form, 'handle', 'Product', 255).toLowerCase();
    if (!HANDLE.test(handle)) return { error: 'Unknown product.' };
    const status = oneOf(form, 'status', COMPLIANCE_STATUSES, 'status');
    const eoRaw = text(form, 'eo_number', { max: 40, label: 'EO number' });
    const eoNumber = normalizeEoNumber(eoRaw);
    if (status === 'carb_eo' && !eoNumber) return { error: 'EO number looks like D-123-45.' };

    const { error } = await createAdminClient().from('sku_compliance').upsert({
      handle,
      status,
      eo_number: status === 'carb_eo' ? eoNumber : null,
      note: text(form, 'note', { max: 300, label: 'Note' }),
      updated_by: viewer.profile.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'handle' });
    if (error) return { error: 'Couldn’t save the tag.' };

    revalidatePath(PATH);
    return { notice: 'Tag saved.' };
  });
}
