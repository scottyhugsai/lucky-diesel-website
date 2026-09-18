import { describe, expect, it } from 'vitest';
import { merchantDetails, type MerchantPolicy } from './merchant';

const policy: MerchantPolicy = {
  shipsProducts: true,
  flatCents: 2500,
  freeOverCents: 50000,
  handlingDays: 1,
  transitDays: 4,
  returnsDays: 30,
  returnsUrl: 'https://luckydiesel.com/policies/refund-policy',
};

describe('merchantDetails', () => {
  it('emits nothing at all until the owner confirms they ship', () => {
    expect(merchantDetails({ ...policy, shipsProducts: false })).toEqual({});
  });

  it('emits nothing when the numbers have not been filled in', () => {
    expect(merchantDetails({ shipsProducts: true, flatCents: null, freeOverCents: null, handlingDays: null, transitDays: null, returnsDays: null, returnsUrl: null })).toEqual({});
  });

  it('builds shipping details from real numbers only', () => {
    const details = merchantDetails(policy);
    const shipping = details.shippingDetails as Record<string, unknown>;
    expect(shipping['@type']).toBe('OfferShippingDetails');
    expect(shipping.shippingRate).toMatchObject({ value: '25.00', currency: 'USD' });
  });

  it('describes the delivery window rather than a vague speed', () => {
    const shipping = merchantDetails(policy).shippingDetails as Record<string, unknown>;
    const time = shipping.deliveryTime as Record<string, unknown>;
    expect(time).toMatchObject({ '@type': 'ShippingDeliveryTime' });
    expect(time.handlingTime).toMatchObject({ minValue: 0, maxValue: 1 });
    expect(time.transitTime).toMatchObject({ minValue: 0, maxValue: 4 });
  });

  it('omits the return policy when no window is set, even if shipping is', () => {
    const details = merchantDetails({ ...policy, returnsDays: null });
    expect(details.shippingDetails).toBeDefined();
    expect(details.hasMerchantReturnPolicy).toBeUndefined();
  });

  it('marks a free-shipping threshold when there is one', () => {
    const shipping = merchantDetails(policy).shippingDetails as Record<string, unknown>;
    expect(shipping.shippingRate).toHaveProperty('freeShippingThreshold');
  });
});
