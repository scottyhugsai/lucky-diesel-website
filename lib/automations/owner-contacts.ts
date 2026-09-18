import 'server-only';
import { BUSINESS } from '@/lib/site';
import type { createAdminClient } from '@/lib/supabase/admin';
import { shopSettings, type Recipient } from './context';
import { selectOwnerRecipients } from './owner-select';

type Db = ReturnType<typeof createAdminClient>;

/**
 * Everyone who should get owner alerts, per channel, with duplicate addresses
 * removed. Falls back to the single `shop_settings` contact when no recipient
 * row is usable, so an empty table never silences alerts.
 */
export async function ownerRecipients(db: Db): Promise<Recipient[]> {
  const [{ data: rows }, shop] = await Promise.all([
    db.from('owner_recipients').select('label, email, phone, notify_email, notify_sms, active').eq('active', true).order('sort').order('created_at'),
    shopSettings(db),
  ]);
  const fallback: Recipient = {
    label: 'Shop owner',
    email: shop?.owner_email ?? BUSINESS.email,
    phone: shop?.owner_phone ?? BUSINESS.phoneDisplay,
    customerId: null,
    isCustomer: false,
  };
  return selectOwnerRecipients(rows ?? [], fallback);
}

/** The first owner recipient, for the few places that address exactly one person. */
export async function ownerRecipient(db: Db): Promise<Recipient> {
  const [first] = await ownerRecipients(db);
  return first!;
}
