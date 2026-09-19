import { describe, expect, it } from 'vitest';
import { calcTotals, type PricingSettings } from '../src/pricing.ts';

const settings: PricingSettings = {
  regionDeliveryFee: 15000,
  freeDeliveryThreshold: 200000,
  regionFreeThreshold: null,
  minOrderAmount: 50000,
  deliveryEnabled: true,
};

describe('calcTotals', () => {
  it('charges the region delivery fee below the (global) threshold', () => {
    const totals = calcTotals([{ price: 100000, oldPrice: null, qty: 1 }], settings, 'delivery');
    expect(totals.itemsTotal).toBe(100000);
    expect(totals.deliveryFee).toBe(15000);
    expect(totals.grandTotal).toBe(115000);
  });

  it('is free exactly at the threshold', () => {
    const totals = calcTotals([{ price: 200000, oldPrice: null, qty: 1 }], settings, 'delivery');
    expect(totals.deliveryFee).toBe(0);
    expect(totals.grandTotal).toBe(200000);
  });

  it('is free above the threshold', () => {
    const totals = calcTotals([{ price: 250000, oldPrice: null, qty: 1 }], settings, 'delivery');
    expect(totals.deliveryFee).toBe(0);
  });

  it('is always free for pickup regardless of total', () => {
    const totals = calcTotals([{ price: 1000, oldPrice: null, qty: 1 }], settings, 'pickup');
    expect(totals.deliveryFee).toBe(0);
    expect(totals.grandTotal).toBe(1000);
  });

  it('treats a null oldPrice as no discount', () => {
    const totals = calcTotals([{ price: 10000, oldPrice: null, qty: 2 }], settings, 'pickup');
    expect(totals.discountTotal).toBe(0);
    expect(totals.itemsTotal).toBe(20000);
  });

  it('flags belowMinimum with the remaining amount', () => {
    const totals = calcTotals([{ price: 10000, oldPrice: null, qty: 1 }], settings, 'pickup');
    expect(totals.belowMinimum).toBe(true);
    expect(totals.amountToMinimum).toBe(40000);
  });

  it('flags deliveryUnavailable when delivery is disabled', () => {
    const disabled: PricingSettings = { ...settings, deliveryEnabled: false };
    const totals = calcTotals([{ price: 100000, oldPrice: null, qty: 1 }], disabled, 'delivery');
    expect(totals.deliveryUnavailable).toBe(true);
  });

  it('throws on invalid input', () => {
    expect(() => calcTotals([{ price: -1, oldPrice: null, qty: 1 }], settings, 'pickup')).toThrow();
    expect(() => calcTotals([{ price: 100, oldPrice: null, qty: 0 }], settings, 'pickup')).toThrow();
  });

  describe('region overrides', () => {
    it('uses the region delivery fee when below the region threshold', () => {
      const withRegionThreshold: PricingSettings = {
        ...settings,
        regionDeliveryFee: 25000,
        regionFreeThreshold: 500000,
      };
      const totals = calcTotals([{ price: 300000, oldPrice: null, qty: 1 }], withRegionThreshold, 'delivery');
      expect(totals.deliveryFee).toBe(25000);
      expect(totals.grandTotal).toBe(325000);
    });

    it('is free at or above the region threshold, overriding the global one', () => {
      const withRegionThreshold: PricingSettings = {
        ...settings,
        regionDeliveryFee: 25000,
        // Region threshold is lower than the global 200000, so it applies instead.
        regionFreeThreshold: 100000,
      };
      const totals = calcTotals([{ price: 150000, oldPrice: null, qty: 1 }], withRegionThreshold, 'delivery');
      expect(totals.deliveryFee).toBe(0);
    });

    it('falls back to the global threshold when regionFreeThreshold is null', () => {
      const noRegionThreshold: PricingSettings = {
        ...settings,
        regionDeliveryFee: 25000,
        regionFreeThreshold: null,
      };
      // Below the global 200000 threshold -> region fee still applies.
      const below = calcTotals([{ price: 150000, oldPrice: null, qty: 1 }], noRegionThreshold, 'delivery');
      expect(below.deliveryFee).toBe(25000);
      // At/above the global threshold -> free.
      const atThreshold = calcTotals([{ price: 200000, oldPrice: null, qty: 1 }], noRegionThreshold, 'delivery');
      expect(atThreshold.deliveryFee).toBe(0);
    });

    it('is always free for pickup even with a region fee configured', () => {
      const withRegionFee: PricingSettings = { ...settings, regionDeliveryFee: 25000 };
      const totals = calcTotals([{ price: 1000, oldPrice: null, qty: 1 }], withRegionFee, 'pickup');
      expect(totals.deliveryFee).toBe(0);
    });
  });
});
