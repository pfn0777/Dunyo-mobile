import type { DeliveryType } from './pricing.ts';

export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'on_the_way' | 'delivered' | 'cancelled';

const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set(['delivered', 'cancelled']);

/**
 * `shipped` means "handed to a courier service for a regional delivery".
 * It is meaningful only for `delivery_type='delivery'`; pickup orders skip
 * straight from `confirmed` to `delivered` (see the pickup carve-out below).
 */
const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'on_the_way', 'cancelled'],
  shipped: ['on_the_way', 'delivered', 'cancelled'],
  on_the_way: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/**
 * Checks whether an order status transition is allowed.
 * Pickup orders additionally allow confirmed -> delivered ("handed over"
 * directly, skipping the courier states entirely).
 */
export function canTransition(from: OrderStatus, to: OrderStatus, deliveryType: DeliveryType): boolean {
  if (ALLOWED_TRANSITIONS[from].includes(to)) {
    return true;
  }
  if (deliveryType === 'pickup' && from === 'confirmed' && to === 'delivered') {
    return true;
  }
  return false;
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
