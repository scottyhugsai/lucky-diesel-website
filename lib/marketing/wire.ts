import 'server-only';
import { attributeConversion, type AttributeConversionInput } from '@/lib/marketing/core/attribution';
import { captureReferral } from '@/lib/marketing/core/referrals';

/**
 * Attribution and referral capture for core flows (leads, bookings, payments).
 * Marketing bookkeeping must never break a customer-facing action, so failures are logged, not thrown.
 */
export async function trackConversion(input: AttributeConversionInput, referralCode?: string | null): Promise<void> {
  try {
    await attributeConversion(input);
    if (referralCode && (input.customerId || input.leadId)) {
      await captureReferral({ code: referralCode, customerId: input.customerId ?? null, leadId: input.leadId ?? null });
    }
  } catch (error) {
    console.error(`[marketing] ${input.kind} attribution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
