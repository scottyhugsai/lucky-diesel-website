/**
 * Marketing event contract.
 *
 * EMITTED BY MARKETING CORE (daily sweep in `lifecycle.ts`, or on capture):
 *   marketing.win_back_6m / marketing.win_back_12m      customer, no paid visit in 6/12 months
 *   service.due                                          customer, mileage-predicted oil/fuel service (existing automation)
 *   marketing.tune_follow_up / marketing.dyno_recheck    customer, 3 / 30 days after a tune record
 *   marketing.seasonal.{towing_season,hurricane_prep,winter_diesel}
 *   marketing.birthday / marketing.customer_anniversary
 *   marketing.build_plan_abandoned                       planner lead, 5–14 days, not booked
 *   marketing.store_checkout_click                       store checkout click by a known customer, no booking since
 *   marketing.referral_created / marketing.referral_rewarded
 *   marketing.review_detractor                           nps_responses score ≤ 6 (part B's table)
 *   marketing.fleet_pm_due / marketing.dyno_day_invite
 *
 * CALLS OTHER AREAS SHOULD ADD (for precise attribution; the cron backfills otherwise):
 *   Lead form / booking action:
 *     attributeConversion({ kind: 'lead' | 'booking', leadId, customerId, appointmentId, cookie: cookies().get('ld_attr')?.value })
 *     and, when `ld_ref` cookie is present: captureReferral({ code, customerId, leadId })
 *   recordPayment (invoice paid):
 *     attributeConversion({ kind: 'job_paid', invoiceId, customerId, valueCents })
 *   Store "checkout" button (client): POST /api/marketing/track { event: 'store_checkout_click', path }
 *   Review/NPS area: emit('marketing.review_detractor', customer) is handled by the sweep from nps_responses;
 *     emit it directly for same-day recovery.
 *   Any drip trigger: enrollByTrigger(eventName, customerId) enrolls in active campaigns whose trigger_event matches.
 *   Automation context: `customerContext` only fills vehicle/due_service; pass richer vars there if templates need them.
 */
export const MARKETING_EVENTS = [
  'marketing.win_back_6m',
  'marketing.win_back_12m',
  'service.due',
  'marketing.tune_follow_up',
  'marketing.dyno_recheck',
  'marketing.seasonal.towing_season',
  'marketing.seasonal.hurricane_prep',
  'marketing.seasonal.winter_diesel',
  'marketing.birthday',
  'marketing.customer_anniversary',
  'marketing.build_plan_abandoned',
  'marketing.store_checkout_click',
  'marketing.referral_created',
  'marketing.referral_rewarded',
  'marketing.review_detractor',
  'marketing.fleet_pm_due',
  'marketing.dyno_day_invite',
] as const;

export type MarketingEvent = (typeof MARKETING_EVENTS)[number];
