import type { Tables } from '@/lib/db/database.types';

/* Presentation vocabulary for automations: lifecycle stages, trigger labels, sample preview values. */

export type StageId = 'leads' | 'appointments' | 'shop' | 'after' | 'owner';

export const STAGES: readonly { id: StageId; label: string; blurb: string }[] = [
  { id: 'leads', label: 'Leads', blurb: 'Answer every request in seconds and follow up until it books.' },
  { id: 'appointments', label: 'Appointments', blurb: 'Confirm bookings and cut no-shows.' },
  { id: 'shop', label: 'In the shop', blurb: 'Keep customers in the loop without a phone call.' },
  { id: 'after', label: 'After the job', blurb: 'Receipts, reviews and bringing trucks back.' },
  { id: 'owner', label: 'Owner', blurb: 'What lands in your own inbox.' },
];

const AFTER_KEYS = new Set(['declined_work_follow_up']);

export function stageOf(automation: Pick<Tables<'automations'>, 'key' | 'trigger_event' | 'audience'>): StageId {
  const event = automation.trigger_event;
  if (AFTER_KEYS.has(automation.key)) return 'after';
  if (event === 'daily.summary') return 'owner';
  if (event.startsWith('lead.')) return 'leads';
  if (event.startsWith('appointment.')) return 'appointments';
  if (event === 'invoice.paid' || event === 'service.due') return 'after';
  return 'shop';
}

const WORK_ORDER_STATUS_LABEL: Record<string, string> = {
  in_progress: 'in progress', waiting_parts: 'waiting on parts', ready: 'ready', quality_check: 'quality check',
  approved: 'approved', paid: 'paid', invoiced: 'invoiced',
};

export function triggerLabel(event: string): string {
  if (event.startsWith('work_order.status:')) {
    const status = event.split(':')[1] ?? '';
    return `Job moves to ${WORK_ORDER_STATUS_LABEL[status] ?? status.replace(/_/g, ' ')}`;
  }
  const labels: Record<string, string> = {
    'lead.created': 'Service request comes in',
    'appointment.booked': 'Appointment booked',
    'inspection.sent': 'Inspection sent',
    'estimate.approved': 'Estimate answered',
    'invoice.created': 'Invoice created',
    'invoice.paid': 'Invoice paid',
    'service.due': 'Service comes due',
    'daily.summary': 'Every morning, 7am',
  };
  return labels[event] ?? event;
}

export const AUDIENCE_LABEL: Record<string, string> = {
  customer: 'Customer',
  owner: 'Owner',
  tech: 'Tech + owner',
};

/** Realistic values for the template preview. */
export const SAMPLE_VARS: Record<string, string> = {
  first_name: 'Cody',
  customer_name: 'Cody Brooks',
  customer_phone: '(843) 555-0142',
  customer_email: 'cody@example.com',
  vehicle: '2019 Ram 2500 6.7L',
  service: 'performance tuning',
  mileage: '84,000',
  details: 'Looking for a tune and a 5" exhaust before summer.',
  shop_phone: '(843) 995-9252',
  booking_link: 'luckydiesel.com/book',
  portal_link: 'luckydiesel.com/portal',
  admin_link: 'luckydiesel.com/admin',
  approval_link: 'luckydiesel.com/portal/jobs/1052',
  pay_link: 'luckydiesel.com/portal/invoices/2214',
  review_link: 'g.page/r/lucky-diesel/review',
  appointment_time: 'Thu, Sep 18, 9:00 AM',
  work_order: '1052',
  job_title: 'Performance tuning',
  estimate_total: '$1,284.50',
  approved_total: '$1,284.50',
  recommended_count: '3',
  declined_items: 'front brake pads',
  invoice_number: '2214',
  invoice_total: '$1,402.10',
  due_service: 'an oil change and fuel filters',
  appointments_today: '4',
  open_jobs: '6',
  new_leads: '3',
  awaiting_approval: '2',
  unpaid_total: '$3,910.00',
  week_revenue: '$12,480.00',
};

export const COMMON_PLACEHOLDERS = ['first_name', 'customer_name', 'vehicle', 'service', 'shop_phone', 'booking_link', 'portal_link'] as const;

export const MINUTES_PER_MESSAGE = 2;

export function subjectHref(type: string, id: string | null): string | null {
  if (!id) return null;
  switch (type) {
    case 'lead': return `/admin/leads/${id}`;
    case 'work_order': return `/admin/jobs/${id}`;
    case 'invoice': return `/admin/invoices/${id}`;
    case 'appointment': return `/admin/calendar?appt=${id}`;
    case 'customer': return `/admin/customers/${id}`;
    default: return null;
  }
}

export const RUN_STATUS_TONE = {
  scheduled: 'info',
  sent: 'good',
  skipped: 'warn',
  failed: 'bad',
  cancelled: 'neutral',
} as const;
