'use server';

import { revalidatePath } from 'next/cache';
import { EMAIL_PATTERN, checked, fail, formatPhone, numberIn, ok, str, type ActionState } from '@/components/admin/ops/form';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const SLOT_OPTIONS = [30, 45, 60, 90, 120, 180, 240];
const MAX_URL = 500;

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('admin');

  const laborRate = numberIn(formData, 'labor_rate', 0, 1000);
  if (laborRate === null) return fail('Labor rate must be between $0 and $1,000 an hour.');
  const taxPercent = numberIn(formData, 'tax_rate', 0, 20);
  if (taxPercent === null) return fail('Tax rate must be between 0% and 20%.');

  const ownerEmail = str(formData, 'owner_email').toLowerCase();
  if (ownerEmail && (!EMAIL_PATTERN.test(ownerEmail) || ownerEmail.length > 254)) return fail('Enter a valid owner email.');
  const rawPhone = str(formData, 'owner_phone');
  const ownerPhone = rawPhone ? formatPhone(rawPhone) : null;
  if (rawPhone && !ownerPhone) return fail('Owner phone must be a 10-digit number.');

  const reviewUrl = str(formData, 'google_review_url');
  if (reviewUrl) {
    let parsed: URL | null = null;
    try { parsed = new URL(reviewUrl); } catch { parsed = null; }
    if (!parsed || parsed.protocol !== 'https:' || reviewUrl.length > MAX_URL) return fail('The Google review link must be a full https:// URL.');
    if (!/(^|\.)google\.com$|(^|\.)g\.page$/.test(parsed.hostname)) return fail('Use a Google review link (google.com or g.page).');
  }

  const bays = numberIn(formData, 'bay_count', 1, 20, { integer: true });
  if (bays === null) return fail('Bays must be a whole number from 1 to 20.');
  const openHour = numberIn(formData, 'open_hour', 0, 23, { integer: true });
  const closeHour = numberIn(formData, 'close_hour', 1, 24, { integer: true });
  if (openHour === null || closeHour === null || closeHour <= openHour) return fail('Closing time must be after opening time.');
  const slotMinutes = numberIn(formData, 'slot_minutes', 15, 480, { integer: true });
  if (slotMinutes === null || !SLOT_OPTIONS.includes(slotMinutes)) return fail('Pick an appointment length from the list.');
  if (slotMinutes > (closeHour - openHour) * 60) return fail('Appointments can’t be longer than the working day.');

  const openDays = [...new Set(formData.getAll('open_days').map((d) => Number(d)))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  if (!openDays.length) return fail('Pick at least one open day.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('shop_settings')
    .update({
      labor_rate_cents: Math.round(laborRate * 100),
      tax_rate: Math.round(taxPercent * 100) / 10_000,
      parts_taxable: checked(formData, 'parts_taxable'),
      labor_taxable: checked(formData, 'labor_taxable'),
      owner_email: ownerEmail || null,
      owner_phone: ownerPhone,
      google_review_url: reviewUrl || null,
      bay_count: bays,
      open_hour: openHour,
      close_hour: closeHour,
      open_days: openDays,
      slot_minutes: slotMinutes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) return fail('Couldn’t save settings. Try again.');

  revalidatePath('/admin', 'layout');
  return ok('Settings saved.');
}
