import type { Enums } from '@/lib/db/database.types';

export const SHOP_TIME_ZONE = 'America/New_York';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function money(cents: number | null | undefined, { whole = false } = {}): string {
  const value = (cents ?? 0) / 100;
  return whole ? usdWhole.format(value) : usd.format(value);
}

export function dateTime(value: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: SHOP_TIME_ZONE,
  }).format(new Date(value));
}

export function dateOnly(value: string | Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: SHOP_TIME_ZONE }).format(new Date(value));
}

export function timeOnly(value: string | Date): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: SHOP_TIME_ZONE }).format(new Date(value));
}

const RELATIVE = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60],
];

export function relativeTime(value: string | Date, now = new Date()): string {
  const seconds = Math.round((new Date(value).getTime() - now.getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

export function vehicleLabel(vehicle: { year?: number | null; make?: string | null; model?: string | null; engine_code?: string | null; nickname?: string | null } | null | undefined): string {
  if (!vehicle) return 'your truck';
  const base = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return vehicle.engine_code ? `${base} ${vehicle.engine_code}`.trim() : base || 'your truck';
}

type WorkOrderStatus = Enums<'work_order_status'>;

/** One vocabulary for job status across the client, employee and admin views. */
export const WORK_ORDER_STATUS: Record<WorkOrderStatus, { label: string; customerLabel: string; tone: 'neutral' | 'info' | 'warn' | 'good' | 'bad' }> = {
  estimate: { label: 'Estimate', customerLabel: 'Checked in', tone: 'neutral' },
  awaiting_approval: { label: 'Awaiting approval', customerLabel: 'Needs your approval', tone: 'warn' },
  approved: { label: 'Approved', customerLabel: 'Approved', tone: 'info' },
  in_progress: { label: 'In progress', customerLabel: 'In the bay', tone: 'info' },
  waiting_parts: { label: 'Waiting on parts', customerLabel: 'Waiting on parts', tone: 'warn' },
  quality_check: { label: 'Quality check', customerLabel: 'Final checks', tone: 'info' },
  ready: { label: 'Ready', customerLabel: 'Ready for pickup', tone: 'good' },
  invoiced: { label: 'Invoiced', customerLabel: 'Ready for pickup', tone: 'good' },
  paid: { label: 'Paid', customerLabel: 'Complete', tone: 'good' },
  cancelled: { label: 'Cancelled', customerLabel: 'Cancelled', tone: 'bad' },
};

/** The customer-facing progress timeline, in order. */
export const CUSTOMER_TIMELINE: WorkOrderStatus[] = ['estimate', 'awaiting_approval', 'in_progress', 'quality_check', 'ready', 'paid'];

/** Allowed next statuses for staff, keeping the pipeline honest. */
export const NEXT_STATUSES: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  estimate: ['awaiting_approval', 'approved', 'cancelled'],
  awaiting_approval: ['approved', 'estimate', 'cancelled'],
  approved: ['in_progress', 'waiting_parts', 'cancelled'],
  in_progress: ['waiting_parts', 'quality_check', 'ready'],
  waiting_parts: ['in_progress', 'cancelled'],
  quality_check: ['in_progress', 'ready'],
  ready: ['invoiced', 'in_progress'],
  invoiced: ['paid'],
  paid: [],
  cancelled: ['estimate'],
};
