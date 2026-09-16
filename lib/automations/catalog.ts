import type { Enums } from '@/lib/db/database.types';

/**
 * Default automations. Seeded into the `automations` table, where the owner
 * can toggle them and edit the wording. `key` is stable; code refers to it.
 *
 * Trigger events:
 *   lead.created · appointment.booked · work_order.status:<status> · inspection.sent
 *   estimate.approved · invoice.created · invoice.paid · daily.summary · service.due
 */
export interface AutomationDefinition {
  key: string;
  name: string;
  description: string;
  triggerEvent: string;
  audience: 'customer' | 'owner' | 'tech';
  channels: Enums<'message_channel'>[];
  anchor: 'event' | 'before_appointment';
  delayMinutes: number;
  sms?: string;
  emailSubject?: string;
  emailBody?: string;
}

const HOUR = 60;
const DAY = 24 * HOUR;

export const AUTOMATIONS: readonly AutomationDefinition[] = [
  // ── Leads ──
  {
    key: 'lead_owner_alert',
    name: 'New lead alert',
    description: 'Tell the owner the moment a service request comes in.',
    triggerEvent: 'lead.created',
    audience: 'owner',
    channels: ['sms', 'email'],
    anchor: 'event',
    delayMinutes: 0,
    sms: 'New lead: {{customer_name}} · {{vehicle}} · {{service}}. {{customer_phone}}. Open: {{admin_link}}',
    emailSubject: 'New service request — {{customer_name}} ({{service}})',
    emailBody:
      '{{customer_name}} just requested {{service}}.\n\nTruck: {{vehicle}}\nMileage: {{mileage}}\nPhone: {{customer_phone}}\nEmail: {{customer_email}}\n\n"{{details}}"\n\nOpen the lead: {{admin_link}}',
  },
  {
    key: 'lead_auto_reply',
    name: 'Lead auto-reply',
    description: 'Confirm the request instantly so the customer doesn’t call the next shop.',
    triggerEvent: 'lead.created',
    audience: 'customer',
    channels: ['sms', 'email'],
    anchor: 'event',
    delayMinutes: 0,
    sms: 'Hey {{first_name}}, Lucky Diesel here. Got your {{service}} request for the {{vehicle}}. We’ll reach out shortly. Reply STOP to opt out.',
    emailSubject: 'We got your request, {{first_name}}',
    emailBody:
      'Hey {{first_name}},\n\nThanks for reaching out about {{service}} for your {{vehicle}}. We’ll get back to you shortly with next steps.\n\nNeed us sooner? Call or text {{shop_phone}}.\n\n— Lucky Diesel',
  },
  {
    key: 'lead_follow_up_1d',
    name: 'Lead follow-up (day 1)',
    description: 'If a lead hasn’t booked after a day, check in.',
    triggerEvent: 'lead.created',
    audience: 'customer',
    channels: ['sms'],
    anchor: 'event',
    delayMinutes: DAY,
    sms: 'Hi {{first_name}}, still want to get the {{vehicle}} in for {{service}}? Book a time here: {{booking_link}}',
  },
  {
    key: 'lead_follow_up_3d',
    name: 'Lead follow-up (day 3)',
    description: 'Last friendly nudge before the lead goes cold.',
    triggerEvent: 'lead.created',
    audience: 'customer',
    channels: ['email'],
    anchor: 'event',
    delayMinutes: 3 * DAY,
    emailSubject: 'Still thinking about your {{vehicle}}?',
    emailBody:
      'Hey {{first_name}},\n\nJust following up on your {{service}} request. If you have questions about parts, tuning or pricing, reply to this email or call {{shop_phone}}.\n\nBook a time: {{booking_link}}\n\n— Lucky Diesel',
  },
  // ── Appointments ──
  {
    key: 'appointment_confirmation',
    name: 'Booking confirmation',
    description: 'Confirm the date and time as soon as it’s booked.',
    triggerEvent: 'appointment.booked',
    audience: 'customer',
    channels: ['sms', 'email'],
    anchor: 'event',
    delayMinutes: 0,
    sms: 'You’re booked, {{first_name}}: {{service}} on {{appointment_time}}. See details in your portal: {{portal_link}}',
    emailSubject: 'Booked: {{service}} on {{appointment_time}}',
    emailBody:
      'Hey {{first_name}},\n\nYou’re on the schedule for {{service}} on {{appointment_time}}.\n\nYour portal: {{portal_link}}\n\nNeed to change it? Call or text {{shop_phone}}.\n\n— Lucky Diesel',
  },
  {
    key: 'appointment_reminder_24h',
    name: 'Appointment reminder (24h)',
    description: 'Cut no-shows with a reminder the day before.',
    triggerEvent: 'appointment.booked',
    audience: 'customer',
    channels: ['sms'],
    anchor: 'before_appointment',
    delayMinutes: DAY,
    sms: 'Reminder: {{vehicle}} is booked at Lucky Diesel tomorrow, {{appointment_time}}. Reply C to confirm or call {{shop_phone}} to reschedule.',
  },
  {
    key: 'appointment_reminder_2h',
    name: 'Appointment reminder (2h)',
    description: 'A final heads-up on the day.',
    triggerEvent: 'appointment.booked',
    audience: 'customer',
    channels: ['sms'],
    anchor: 'before_appointment',
    delayMinutes: 2 * HOUR,
    sms: 'See you soon, {{first_name}}. Your {{service}} appointment is at {{appointment_time}}.',
  },
  // ── Work orders ──
  {
    key: 'job_checked_in',
    name: 'Truck checked in',
    description: 'Let the customer know work has started and where to follow along.',
    triggerEvent: 'work_order.status:in_progress',
    audience: 'customer',
    channels: ['sms'],
    anchor: 'event',
    delayMinutes: 0,
    sms: 'Your {{vehicle}} is in the bay, {{first_name}}. Follow progress live: {{portal_link}}',
  },
  {
    key: 'inspection_ready',
    name: 'Inspection & estimate ready',
    description: 'Send the photo inspection and estimate for approval.',
    triggerEvent: 'inspection.sent',
    audience: 'customer',
    channels: ['sms', 'email'],
    anchor: 'event',
    delayMinutes: 0,
    sms: '{{first_name}}, your inspection for the {{vehicle}} is ready: {{recommended_count}} items with photos, {{estimate_total}}. Review & approve: {{approval_link}}',
    emailSubject: 'Your {{vehicle}} inspection is ready to review',
    emailBody:
      'Hey {{first_name}},\n\nWe finished inspecting your {{vehicle}}. There are {{recommended_count}} recommended items totaling {{estimate_total}}, each with photos and notes.\n\nApprove or decline each item here: {{approval_link}}\n\n— Lucky Diesel',
  },
  {
    key: 'estimate_nudge',
    name: 'Estimate approval nudge',
    description: 'If an estimate isn’t answered in 4 hours, send a gentle reminder.',
    triggerEvent: 'inspection.sent',
    audience: 'customer',
    channels: ['sms'],
    anchor: 'event',
    delayMinutes: 4 * HOUR,
    sms: 'Hi {{first_name}}, we’re holding your {{vehicle}} until you review the estimate. Approve here: {{approval_link}} or call {{shop_phone}}.',
  },
  {
    key: 'estimate_decision_alert',
    name: 'Approval alert to shop',
    description: 'Tell the tech and owner the moment the customer approves.',
    triggerEvent: 'estimate.approved',
    audience: 'tech',
    channels: ['sms'],
    anchor: 'event',
    delayMinutes: 0,
    sms: 'WO #{{work_order}} approved by {{customer_name}}: {{approved_total}}. Good to go on the {{vehicle}}.',
  },
  {
    key: 'waiting_parts',
    name: 'Waiting on parts',
    description: 'Keep the customer in the loop when parts hold up a job.',
    triggerEvent: 'work_order.status:waiting_parts',
    audience: 'customer',
    channels: ['sms'],
    anchor: 'event',
    delayMinutes: 0,
    sms: 'Update on your {{vehicle}}: we’re waiting on parts. We’ll text you as soon as they land. {{portal_link}}',
  },
  {
    key: 'job_ready',
    name: 'Truck ready for pickup',
    description: 'Pickup notice with the invoice and pay link.',
    triggerEvent: 'invoice.created',
    audience: 'customer',
    channels: ['sms', 'email'],
    anchor: 'event',
    delayMinutes: 0,
    sms: 'Your {{vehicle}} is ready, {{first_name}}! Invoice {{invoice_total}}. Pay online to skip the counter: {{pay_link}}',
    emailSubject: 'Your {{vehicle}} is ready — invoice #{{invoice_number}}',
    emailBody:
      'Hey {{first_name}},\n\nYour {{vehicle}} is done and ready for pickup.\n\nInvoice #{{invoice_number}}: {{invoice_total}}\nPay online: {{pay_link}}\n\nWork details, photos and your truck’s history are in your portal: {{portal_link}}\n\n— Lucky Diesel',
  },
  // ── After the job ──
  {
    key: 'payment_receipt',
    name: 'Payment receipt',
    description: 'Receipt and thanks as soon as an invoice is paid.',
    triggerEvent: 'invoice.paid',
    audience: 'customer',
    channels: ['email'],
    anchor: 'event',
    delayMinutes: 0,
    emailSubject: 'Receipt for invoice #{{invoice_number}}',
    emailBody:
      'Thanks, {{first_name}}.\n\nWe received your payment of {{invoice_total}} for invoice #{{invoice_number}} ({{vehicle}}).\n\nYour full service record is in your portal: {{portal_link}}\n\n— Lucky Diesel',
  },
  {
    key: 'review_request',
    name: 'Google review request',
    description: 'Asks every customer for a review the day after pickup. No filtering, per Google policy.',
    triggerEvent: 'invoice.paid',
    audience: 'customer',
    channels: ['sms'],
    anchor: 'event',
    delayMinutes: DAY,
    sms: 'Thanks for trusting us with the {{vehicle}}, {{first_name}}. Mind sharing how it went? {{review_link}}',
  },
  {
    key: 'review_reminder',
    name: 'Review reminder',
    description: 'One reminder, three days later, only if they haven’t been asked again.',
    triggerEvent: 'invoice.paid',
    audience: 'customer',
    channels: ['email'],
    anchor: 'event',
    delayMinutes: 4 * DAY,
    emailSubject: 'How’s the {{vehicle}} running?',
    emailBody:
      'Hey {{first_name}},\n\nHope the truck is running strong. If you have a minute, a Google review helps other diesel owners find us: {{review_link}}\n\nAnything not right? Reply here and it comes straight to the owner.\n\n— Lucky Diesel',
  },
  {
    key: 'service_due',
    name: 'Service due reminder',
    description: 'Brings customers back when maintenance or a tune check is due.',
    triggerEvent: 'service.due',
    audience: 'customer',
    channels: ['sms'],
    anchor: 'event',
    delayMinutes: 0,
    sms: 'Hey {{first_name}}, the {{vehicle}} is due for {{due_service}}. Grab a time: {{booking_link}}',
  },
  {
    key: 'declined_work_follow_up',
    name: 'Declined work follow-up',
    description: '30 days after an item is declined, remind the customer it’s still recommended.',
    triggerEvent: 'estimate.approved',
    audience: 'customer',
    channels: ['email'],
    anchor: 'event',
    delayMinutes: 30 * DAY,
    emailSubject: 'Still on the list for your {{vehicle}}',
    emailBody:
      'Hey {{first_name}},\n\nLast visit we recommended: {{declined_items}}. Want to get it taken care of? Book here: {{booking_link}}\n\n— Lucky Diesel',
  },
  // ── Owner ──
  {
    key: 'daily_summary',
    name: 'Owner daily summary',
    description: '7am email: today’s schedule, new leads, open estimates and unpaid invoices.',
    triggerEvent: 'daily.summary',
    audience: 'owner',
    channels: ['email'],
    anchor: 'event',
    delayMinutes: 0,
    emailSubject: 'Lucky Diesel today: {{appointments_today}} appointments, {{new_leads}} new leads',
    emailBody:
      'Good morning.\n\nToday: {{appointments_today}} appointments\nIn the shop: {{open_jobs}} open jobs\nNew leads (24h): {{new_leads}}\nWaiting on approval: {{awaiting_approval}}\nUnpaid invoices: {{unpaid_total}}\nRevenue this week: {{week_revenue}}\n\nDashboard: {{admin_link}}',
  },
];

/** Minutes are only used for display in the admin. */
export function describeTiming(definition: Pick<AutomationDefinition, 'anchor' | 'delayMinutes'>): string {
  const { anchor, delayMinutes } = definition;
  const amount =
    delayMinutes === 0
      ? ''
      : delayMinutes % DAY === 0
        ? `${delayMinutes / DAY} day${delayMinutes / DAY === 1 ? '' : 's'}`
        : delayMinutes % HOUR === 0
          ? `${delayMinutes / HOUR} hour${delayMinutes / HOUR === 1 ? '' : 's'}`
          : `${delayMinutes} min`;
  if (anchor === 'before_appointment') return `${amount} before appointment`;
  return amount ? `${amount} after` : 'Instantly';
}
