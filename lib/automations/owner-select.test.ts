import { describe, expect, test } from 'vitest';
import { deliveryNotes, duplicateNotes, selectOwnerRecipients, type AlertRecipient, type OwnerRecipientRow } from './owner-select';

const FALLBACK: AlertRecipient = { label: 'Shop owner', email: 'shop@luckydiesel.com', phone: '(843) 555-0100', customerId: null, isCustomer: false };

function row(over: Partial<OwnerRecipientRow> = {}): OwnerRecipientRow {
  return { label: 'Owner', email: 'owner@luckydiesel.com', phone: '(843) 555-0100', notify_email: true, notify_sms: true, active: true, ...over };
}

describe('selectOwnerRecipients', () => {
  test('falls back to the shop_settings contact when the table is empty', () => {
    expect(selectOwnerRecipients([], FALLBACK)).toEqual([FALLBACK]);
  });

  test('falls back when every row is inactive or has no enabled channel', () => {
    const rows = [row({ active: false }), row({ label: 'Muted', email: 'a@b.com', phone: null, notify_email: false })];
    expect(selectOwnerRecipients(rows, FALLBACK)).toEqual([FALLBACK]);
  });

  test('returns every active recipient in the order given', () => {
    const rows = [row({ label: 'Scotty', email: 'scotty@dev.com', phone: '(843) 555-0111' }), row({ label: 'Owner' })];
    expect(selectOwnerRecipients(rows, FALLBACK).map((r) => r.label)).toEqual(['Scotty', 'Owner']);
  });

  test('drops the email of a recipient who only wants texts, and vice versa', () => {
    const rows = [
      row({ label: 'Texts only', email: 'text@b.com', phone: '(843) 555-0111', notify_email: false }),
      row({ label: 'Email only', email: 'mail@b.com', phone: '(843) 555-0122', notify_sms: false }),
    ];
    const [texts, mail] = selectOwnerRecipients(rows, FALLBACK);
    expect(texts).toMatchObject({ email: null, phone: '(843) 555-0111' });
    expect(mail).toMatchObject({ email: 'mail@b.com', phone: null });
  });

  test('deduplicates the same address across rows, per channel', () => {
    const rows = [
      row({ label: 'First', email: 'Owner@LuckyDiesel.com', phone: '843-555-0100' }),
      row({ label: 'Duplicate', email: 'owner@luckydiesel.com', phone: '+1 (843) 555-0100' }),
      row({ label: 'Shared inbox, own phone', email: 'owner@luckydiesel.com', phone: '(843) 555-0199' }),
    ];
    const chosen = selectOwnerRecipients(rows, FALLBACK);
    expect(chosen.map((r) => r.label)).toEqual(['First', 'Shared inbox, own phone']);
    expect(chosen[1]).toMatchObject({ email: null, phone: '(843) 555-0199' });
  });

  test('never marks an owner recipient as a customer', () => {
    expect(selectOwnerRecipients([row()], FALLBACK).every((r) => !r.isCustomer && r.customerId === null)).toBe(true);
  });

  test('ignores blank strings', () => {
    expect(selectOwnerRecipients([row({ email: '   ', phone: '' })], FALLBACK)).toEqual([FALLBACK]);
  });
});

describe('deliveryNotes', () => {
  const live = { demoInbox: null, emailConfigured: true, smsLive: true };

  test('names the demo inbox when email is redirected', () => {
    const notes = deliveryNotes(row(), { ...live, demoInbox: 'demo@presenter.com', smsLive: false });
    expect(notes[0]).toBe('Demo mode: delivered to demo@presenter.com, not to owner@luckydiesel.com.');
  });

  test('does not claim a redirect when the address already is the demo inbox', () => {
    const notes = deliveryNotes(row({ email: 'demo@presenter.com' }), { ...live, demoInbox: 'demo@presenter.com' });
    expect(notes[0]).toBe('Demo mode: delivered to demo@presenter.com — this address is the demo inbox.');
  });

  test('warns that SMS is simulated when the mode is not live', () => {
    expect(deliveryNotes(row(), { ...live, smsLive: false })).toContain('Simulated — shows in Messages, not delivered.');
  });

  test('mentions the Resend sending-domain limit on real email', () => {
    expect(deliveryNotes(row(), live)[0]).toContain('sending domain is verified');
  });

  test('says when a channel is switched off, and when email is not configured', () => {
    expect(deliveryNotes(row({ notify_sms: false }), live)).toContain('SMS: turned off for this person.');
    expect(deliveryNotes(row(), { ...live, emailConfigured: false })[0]).toContain('RESEND_API_KEY');
  });
});

describe('duplicateNotes', () => {
  test('names the row that already covers a repeated address', () => {
    const notes = duplicateNotes([
      row({ label: 'Owner', email: 'a@b.com', phone: '(843) 555-0100' }),
      row({ label: 'Scotty', email: 'A@B.com', phone: '(843) 555-0111' }),
    ]);
    expect(notes[0]).toEqual([]);
    expect(notes[1]).toEqual(['Email already goes to Owner — this copy is not sent twice.']);
  });

  test('says nothing for distinct addresses or inactive rows', () => {
    const notes = duplicateNotes([
      row({ label: 'Owner', email: 'a@b.com', phone: '(843) 555-0100' }),
      row({ label: 'Off', email: 'a@b.com', phone: '(843) 555-0100', active: false }),
      row({ label: 'Other', email: 'c@d.com', phone: '(843) 555-0122' }),
    ]);
    expect(notes).toEqual([[], [], []]);
  });
});
