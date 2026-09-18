/**
 * Merchant listing details for product structured data.
 *
 * Google kept investing in merchant listings through 2025–26 while retiring the
 * FAQ and HowTo rich results, so this is where the surface area now is. But
 * shipping costs and return windows are business facts: every field here comes
 * from what the owner has actually recorded, and the whole block is omitted
 * until they have. Markup that guesses is worse than no markup.
 */

export interface MerchantPolicy {
  shipsProducts: boolean;
  flatCents: number | null;
  freeOverCents: number | null;
  handlingDays: number | null;
  transitDays: number | null;
  returnsDays: number | null;
  returnsUrl: string | null;
}

const dollars = (cents: number) => (cents / 100).toFixed(2);

export function merchantDetails(policy: MerchantPolicy): Record<string, unknown> {
  if (!policy.shipsProducts) return {};
  const details: Record<string, unknown> = {};

  const hasRate = policy.flatCents !== null;
  const hasWindow = policy.handlingDays !== null && policy.transitDays !== null;
  if (hasRate || hasWindow) {
    const shipping: Record<string, unknown> = {
      '@type': 'OfferShippingDetails',
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
    };
    if (hasRate) {
      shipping.shippingRate = {
        '@type': 'MonetaryAmount',
        value: dollars(policy.flatCents as number),
        currency: 'USD',
        ...(policy.freeOverCents !== null
          ? { freeShippingThreshold: { '@type': 'DeliveryChargeSpecification', eligibleTransactionVolume: { '@type': 'PriceSpecification', minPrice: dollars(policy.freeOverCents), priceCurrency: 'USD' } } }
          : {}),
      };
    }
    if (hasWindow) {
      shipping.deliveryTime = {
        '@type': 'ShippingDeliveryTime',
        handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: policy.handlingDays, unitCode: 'DAY' },
        transitTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: policy.transitDays, unitCode: 'DAY' },
      };
    }
    details.shippingDetails = shipping;
  }

  if (policy.returnsDays !== null) {
    details.hasMerchantReturnPolicy = {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'US',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: policy.returnsDays,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/FreeReturn',
      ...(policy.returnsUrl ? { merchantReturnLink: policy.returnsUrl } : {}),
    };
  }

  return details;
}

/** The owner's recorded policy, or a shape that emits nothing. */
export function policyFromSettings(row: Record<string, unknown> | null | undefined): MerchantPolicy {
  const num = (key: string) => (typeof row?.[key] === 'number' ? (row[key] as number) : null);
  return {
    shipsProducts: row?.ships_products === true,
    flatCents: num('shipping_flat_cents'),
    freeOverCents: num('shipping_free_over_cents'),
    handlingDays: num('shipping_handling_days'),
    transitDays: num('shipping_transit_days'),
    returnsDays: num('returns_days'),
    returnsUrl: typeof row?.returns_url === 'string' ? row.returns_url : null,
  };
}
