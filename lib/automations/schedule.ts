/** Pure timing rules for automation runs. */

export interface ScheduleInput {
  anchor: string;
  delayMinutes: number;
  eventAt: Date;
  appointmentStartsAt?: Date | null;
}

const MINUTE_MS = 60_000;

/**
 * When a run should fire, or null when it should not be scheduled at all
 * (e.g. a 24h reminder for an appointment booked 3 hours out).
 */
export function computeScheduledFor({ anchor, delayMinutes, eventAt, appointmentStartsAt }: ScheduleInput): Date | null {
  if (anchor === 'before_appointment') {
    if (!appointmentStartsAt) return null;
    const at = new Date(appointmentStartsAt.getTime() - delayMinutes * MINUTE_MS);
    return at.getTime() > eventAt.getTime() ? at : null;
  }
  return new Date(eventAt.getTime() + delayMinutes * MINUTE_MS);
}

/** Stable key so re-emitting the same event never double-schedules a message. */
export function dedupeKey(automationKey: string, subjectType: string, subjectId: string | null, discriminator = ''): string {
  return [automationKey, subjectType, subjectId ?? 'none', discriminator].filter(Boolean).join(':');
}

/** Quiet hours for customer texts: never deliver between 9pm and 8am shop time. */
export function applyQuietHours(at: Date, timeZone = 'America/New_York', startHour = 21, endHour = 8): Date {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(at));
  if (hour >= endHour && hour < startHour) return at;
  const hoursUntilOpen = hour >= startHour ? 24 - hour + endHour : endHour - hour;
  const shifted = new Date(at.getTime() + hoursUntilOpen * 60 * MINUTE_MS);
  shifted.setUTCMinutes(0, 0, 0);
  return shifted;
}
