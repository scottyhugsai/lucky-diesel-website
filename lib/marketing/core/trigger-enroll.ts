import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { enrollByTrigger } from './campaigns';

type SubjectTable = 'leads' | 'appointments' | 'work_orders' | 'invoices';
const SUBJECT_TABLE: Record<string, SubjectTable> = { lead: 'leads', appointment: 'appointments', work_order: 'work_orders', invoice: 'invoices' };

/**
 * Hook for the automation engine: enrolls the event's customer in owner-built
 * drips whose `trigger_event` matches. Fails soft; never blocks the automation.
 */
export async function enrollDripsForEvent(event: { name: string; subjectType: string; subjectId: string | null; occurredAt?: Date }): Promise<number> {
  if (!event.subjectId || event.subjectType === 'shop') return 0;
  try {
    const db = createAdminClient();
    const { count } = await db.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('trigger_event', event.name).neq('kind', 'broadcast');
    if (!count) return 0;
    let customerId: string | null = event.subjectType === 'customer' ? event.subjectId : null;
    const table = SUBJECT_TABLE[event.subjectType];
    if (table) {
      const { data } = await db.from(table).select('customer_id').eq('id', event.subjectId).maybeSingle();
      customerId = (data as { customer_id: string | null } | null)?.customer_id ?? null;
    }
    return customerId ? await enrollByTrigger(event.name, customerId, event.occurredAt ?? new Date(), db) : 0;
  } catch (error) {
    console.error(`[marketing] drip enrollment for ${event.name} failed: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}
