export type DeliveryType = 'delivery' | 'pickup';

export interface PricingItem {
  price: number;
  oldPrice: number | null;
  qty: number;
}

export interface PricingSettings {
  /** The selected region's own delivery fee (regions.delivery_fee). */
  regionDeliveryFee: number;
  /** Global free-delivery threshold (settings.free_delivery_threshold). */
  freeDeliveryThreshold: number;
  /** Region override of the global free-delivery threshold; null falls back to it. */
  regionFreeThreshold: number | null;
  minOrderAmount: number;
  deliveryEnabled: boolean;
}

export interface PricingTotals {
  itemsTotal: number;
  discountTotal: number;
  deliveryFee: number;
  grandTotal: number;
  belowMinimum: boolean;
  amountToMinimum: number;
  deliveryUnavailable: boolean;
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`calcTotals: ${label} must be a non-negative integer, got ${value}`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`calcTotals: ${label} must be a positive integer, got ${value}`);
  }
}

/**
 * Computes order totals per the spec formula:
 * itemsTotal = Σ price × qty
 * discountTotal = Σ (oldPrice − price) × qty (informational only)
 * threshold = regionFreeThreshold ?? freeDeliveryThreshold
 * deliveryFee = pickup ? 0 : (itemsTotal >= threshold ? 0 : regionDeliveryFee)
 * grandTotal = itemsTotal + deliveryFee
 */
export function calcTotals(
  items: readonly PricingItem[],
  settings: PricingSettings,
  deliveryType: DeliveryType,
): PricingTotals {
  let itemsTotal = 0;
  let discountTotal = 0;

  for (const item of items) {
    assertNonNegativeInteger(item.price, 'price');
    assertPositiveInteger(item.qty, 'qty');
    if (item.oldPrice !== null) {
      assertNonNegativeInteger(item.oldPrice, 'oldPrice');
    }
    itemsTotal += item.price * item.qty;
    if (item.oldPrice !== null) {
      discountTotal += (item.oldPrice - item.price) * item.qty;
    }
  }

  const deliveryUnavailable = deliveryType === 'delivery' && !settings.deliveryEnabled;

  const threshold = settings.regionFreeThreshold ?? settings.freeDeliveryThreshold;

  const deliveryFee =
    deliveryType === 'pickup'
      ? 0
      : itemsTotal >= threshold
        ? 0
        : settings.regionDeliveryFee;

  const grandTotal = itemsTotal + deliveryFee;
  const belowMinimum = itemsTotal < settings.minOrderAmount;
  const amountToMinimum = belowMinimum ? settings.minOrderAmount - itemsTotal : 0;

  return {
    itemsTotal,
    discountTotal,
    deliveryFee,
    grandTotal,
    belowMinimum,
    amountToMinimum,
    deliveryUnavailable,
  };
}
