import { describe, expect, it } from 'vitest';
import { AUTOMATIONS } from '@/lib/automations/catalog';
import { SEASONAL_TEMPLATES } from '@/components/admin/marketing/core-ui/seasonal';
import { policyBlockMessage } from './compliance';

describe('built-in wording passes lint-on-save', () => {
  it.each(AUTOMATIONS.map((a) => [a.key, a] as const))('%s', (_key, a) => {
    expect(policyBlockMessage([a.sms, a.emailSubject, a.emailBody])).toBeNull();
  });
  it.each(SEASONAL_TEMPLATES.map((t) => [t.key, t] as const))('seasonal %s', (_key, t) => {
    expect(policyBlockMessage([t.subject, t.body])).toBeNull();
  });
});
