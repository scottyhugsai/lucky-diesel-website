/**
 * Who receives owner alerts, and what the admin screen honestly says about
 * delivery. Pure: no database, no env reads, so it is unit-tested directly.
 */

export interface AlertRecipient {
  /** Shown in run details and the admin list, e.g. "Scotty — developer". */
  label?: string;
  email: string | null;
  phone: string | null;
  customerId: string | null;
  /** Customer texts need consent; owner/staff alerts don't. */
  isCustomer: boolean;
}

export interface OwnerRecipientRow {
  label: string;
  email: string | null;
  phone: string | null;
  notify_email: boolean;
  notify_sms: boolean;
  active: boolean;
}

function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function emailKey(email: string): string {
  return email.toLowerCase();
}

function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits || phone.toLowerCase();
}

/**
 * Active rows in order, each keeping only the channels it opted into, with
 * repeated addresses dropped so nobody is alerted twice. Falls back to the
 * single `shop_settings` contact when the table yields nobody.
 */
export function selectOwnerRecipients(rows: readonly OwnerRecipientRow[], fallback: AlertRecipient): AlertRecipient[] {
  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const chosen: AlertRecipient[] = [];

  for (const row of rows) {
    if (!row.active) continue;
    const email = row.notify_email ? clean(row.email) : null;
    const phone = row.notify_sms ? clean(row.phone) : null;
    const newEmail = email && !seenEmails.has(emailKey(email)) ? email : null;
    const newPhone = phone && !seenPhones.has(phoneKey(phone)) ? phone : null;
    if (!newEmail && !newPhone) continue;
    if (newEmail) seenEmails.add(emailKey(newEmail));
    if (newPhone) seenPhones.add(phoneKey(newPhone));
    chosen.push({ label: row.label, email: newEmail, phone: newPhone, customerId: null, isCustomer: false });
  }

  return chosen.length ? chosen : [fallback];
}

export interface DeliveryMode {
  /** DEMO_EMAIL_TO — every email is redirected here. */
  demoInbox: string | null;
  /** RESEND_API_KEY present. */
  emailConfigured: boolean;
  /** MESSAGING_SMS_MODE === 'live'. */
  smsLive: boolean;
}

/**
 * What will really happen for this recipient, in plain words. The admin screen
 * shows these so nobody assumes a demo send reached the shop owner's inbox.
 */
export function deliveryNotes(row: Pick<OwnerRecipientRow, 'email' | 'phone' | 'notify_email' | 'notify_sms'>, mode: DeliveryMode): string[] {
  const notes: string[] = [];
  const email = clean(row.email);
  const phone = clean(row.phone);

  if (row.notify_email && email) {
    if (!mode.emailConfigured) notes.push('Email: RESEND_API_KEY is not set — sends fail and are logged in Messages.');
    else if (mode.demoInbox && mode.demoInbox.toLowerCase() === email.toLowerCase()) notes.push(`Demo mode: delivered to ${mode.demoInbox} — this address is the demo inbox.`);
    else if (mode.demoInbox) notes.push(`Demo mode: delivered to ${mode.demoInbox}, not to ${email}.`);
    else notes.push(`Email: delivered to ${email}. Resend only delivers to the account owner until a sending domain is verified.`);
  } else if (email) {
    notes.push('Email: turned off for this person.');
  }

  if (row.notify_sms && phone) {
    notes.push(mode.smsLive ? `SMS: delivered to ${phone}.` : 'Simulated — shows in Messages, not delivered.');
  } else if (phone) {
    notes.push('SMS: turned off for this person.');
  }

  return notes;
}

/**
 * Per row, the channels whose address an earlier active row already covers, so
 * the admin screen can say why that copy is not sent. Indexes match `rows`.
 */
export function duplicateNotes(rows: readonly (OwnerRecipientRow & { label: string })[]): string[][] {
  const emailOwner = new Map<string, string>();
  const phoneOwner = new Map<string, string>();
  return rows.map((row) => {
    const notes: string[] = [];
    if (!row.active) return notes;
    const email = row.notify_email ? clean(row.email) : null;
    const phone = row.notify_sms ? clean(row.phone) : null;
    if (email) {
      const first = emailOwner.get(emailKey(email));
      if (first) notes.push(`Email already goes to ${first} — this copy is not sent twice.`);
      else emailOwner.set(emailKey(email), row.label);
    }
    if (phone) {
      const first = phoneOwner.get(phoneKey(phone));
      if (first) notes.push(`Texts already go to ${first} — this copy is not sent twice.`);
      else phoneOwner.set(phoneKey(phone), row.label);
    }
    return notes;
  });
}
