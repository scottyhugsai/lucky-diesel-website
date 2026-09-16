import type { Lead } from './lead';

/**
 * Sends a service request to the shop by email through Resend.
 *
 * With RESEND_API_KEY / LEAD_NOTIFY_EMAIL unset (local dev, preview deploys)
 * it logs the full request at error level and returns delivered:false, so the
 * form can hand the visitor a text/email fallback instead of a false success.
 */

export interface DeliveryResult {
  delivered: boolean;
  error?: string;
}

const TIMEOUT_MS = 8000;

function summary(lead: Lead): string {
  return [
    `Name:     ${lead.name}`,
    `Phone:    ${lead.phone}`,
    `Email:    ${lead.email}`,
    `Truck:    ${lead.platformLabel}`,
    `Mileage:  ${lead.mileage || '(not given)'}`,
    `Service:  ${lead.serviceLabel}`,
    '',
    lead.details,
  ].join('\n');
}

export async function deliverLead(lead: Lead): Promise<DeliveryResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const to = process.env.LEAD_NOTIFY_EMAIL?.trim();
  const from = process.env.LEAD_FROM_EMAIL?.trim() || 'Lucky Diesel Website <onboarding@resend.dev>';

  if (!key || !to) {
    const missing = !key ? 'RESEND_API_KEY' : 'LEAD_NOTIFY_EMAIL';
    console.error(`[lead] NOT DELIVERED — ${missing} is not set.\n${summary(lead)}`);
    return { delivered: false, error: `${missing} not set` };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: lead.email,
        subject: `Service request: ${lead.serviceLabel} — ${lead.platformLabel} (${lead.name})`,
        text: summary(lead),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`[lead] Resend rejected (${response.status}): ${detail}\n${summary(lead)}`);
      return { delivered: false, error: `Resend ${response.status}` };
    }
    return { delivered: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[lead] Resend request failed: ${message}\n${summary(lead)}`);
    return { delivered: false, error: message };
  }
}
