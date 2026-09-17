'use client';

/**
 * One event map for every tag. Our own first-party `conversion_events` stay the
 * source of truth; this only mirrors the same moments into whichever pixels the
 * visitor allowed. Nothing here throws if a tag never loaded.
 */
export type SiteEvent =
  | 'lead'
  | 'booking'
  | 'plan_built'
  | 'chat_start'
  | 'waitlist_join'
  | 'call_click'
  | 'text_click';

interface EventMap {
  ga4: string;
  meta: string | null;
  tiktok: string | null;
  /** Fires the Google Ads lead conversion too. */
  adsLead?: boolean;
}

export const EVENT_MAP: Record<SiteEvent, EventMap> = {
  lead: { ga4: 'generate_lead', meta: 'Lead', tiktok: 'SubmitForm', adsLead: true },
  booking: { ga4: 'schedule', meta: 'Schedule', tiktok: 'CompleteRegistration', adsLead: true },
  plan_built: { ga4: 'plan_built', meta: 'ViewContent', tiktok: 'ViewContent' },
  chat_start: { ga4: 'chat_start', meta: 'Contact', tiktok: 'Contact' },
  waitlist_join: { ga4: 'sign_up', meta: 'Subscribe', tiktok: 'Subscribe' },
  call_click: { ga4: 'contact_call', meta: 'Contact', tiktok: 'Contact' },
  text_click: { ga4: 'contact_text', meta: 'Contact', tiktok: 'Contact' },
};

interface TagWindow extends Window {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  ttq?: { track: (name: string, params?: Record<string, unknown>) => void };
  __ldAdsLead?: string;
}

/**
 * `eventId` is the same value our server sends to the Conversions API, so Meta
 * can collapse the browser and server copies into one conversion.
 */
export function trackEvent(event: SiteEvent, params: { valueCents?: number; eventId?: string } = {}): void {
  if (typeof window === 'undefined') return;
  const map = EVENT_MAP[event];
  const w = window as TagWindow;
  const value = params.valueCents ? Math.round(params.valueCents) / 100 : undefined;
  try {
    w.gtag?.('event', map.ga4, { currency: 'USD', ...(value ? { value } : {}) });
    if (map.adsLead && w.__ldAdsLead) w.gtag?.('event', 'conversion', { send_to: w.__ldAdsLead, ...(value ? { value, currency: 'USD' } : {}) });
    if (map.meta) w.fbq?.('track', map.meta, value ? { value, currency: 'USD' } : {}, params.eventId ? { eventID: params.eventId } : undefined);
    if (map.tiktok) w.ttq?.track(map.tiktok, { ...(value ? { value, currency: 'USD' } : {}), ...(params.eventId ? { event_id: params.eventId } : {}) });
  } catch {
    // A blocked or half-loaded tag must never break the form that just succeeded.
  }
}
