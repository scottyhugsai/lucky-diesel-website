import { describe, expect, test } from 'vitest';
import { mapGoogleLead, mapMetaLead, parseLeadEmail } from './external-leads';

describe('Meta lead ads', () => {
  test('maps field_data and keeps extra answers in details', () => {
    const lead = mapMetaLead({
      id: '123', ad_id: '999', form_id: '55',
      field_data: [
        { name: 'full_name', values: ['Cody Hart'] },
        { name: 'email', values: ['CODY@example.com'] },
        { name: 'phone_number', values: ['+1 843-555-0101'] },
        { name: 'what_truck?', values: ['2019 Ram 2500'] },
      ],
    });
    expect(lead).toMatchObject({ name: 'Cody Hart', email: 'cody@example.com', phone: '(843) 555-0101', externalId: '123', source: 'meta_lead_ads' });
    expect(lead?.details).toContain('what truck?: 2019 Ram 2500');
    expect(lead?.details).toContain('ad: 999');
  });

  test('rejects payloads without a usable phone or email', () => {
    expect(mapMetaLead({ field_data: [{ name: 'full_name', values: ['A B'] }] })).toBeNull();
    expect(mapMetaLead(null)).toBeNull();
  });
});

describe('Google lead form', () => {
  test('maps user_column_data', () => {
    const lead = mapGoogleLead({
      lead_id: 'g-1', campaign_id: 42,
      user_column_data: [
        { column_id: 'FIRST_NAME', string_value: 'Dana' }, { column_id: 'LAST_NAME', string_value: 'Ruiz' },
        { column_id: 'EMAIL', string_value: 'dana@example.com' }, { column_id: 'PHONE_NUMBER', string_value: '8435550199' },
        { column_id: 'VEHICLE_MODEL', string_value: 'F-250' },
      ],
    });
    expect(lead).toMatchObject({ name: 'Dana Ruiz', phone: '(843) 555-0199', externalId: 'g-1' });
    expect(lead?.details).toContain('vehicle model: F-250');
  });
});

describe('lead emails', () => {
  test('parses labeled lines and names the platform', () => {
    const lead = parseLeadEmail({
      from: 'leads@angi.com', subject: 'New lead: diesel repair',
      text: 'You have a new lead\nCustomer Name: Sam Lee\nPhone: 843.555.0123\nEmail: sam@example.com\nVehicle: 2006 F-350 6.0\nMessage: Head gaskets?',
    });
    expect(lead).toMatchObject({ name: 'Sam Lee', phone: '(843) 555-0123', email: 'sam@example.com', source: 'lead_email' });
    expect(lead?.details).toContain('platform: Angi');
    expect(lead?.details).toContain('Head gaskets?');
  });

  test('returns null when contact lines are missing', () => {
    expect(parseLeadEmail({ from: 'x@y.com', subject: 'hi', text: 'nothing here' })).toBeNull();
  });
});
