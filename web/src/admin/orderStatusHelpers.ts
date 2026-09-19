import { canTransition } from '@dunyo/shared';
import type { OrderStatus } from '@dunyo/shared';
import type { DeliveryType } from '../lib/types.ts';

const ALL_STATUSES: readonly OrderStatus[] = ['new', 'confirmed', 'shipped', 'on_the_way', 'delivered', 'cancelled'];

/** Every status the admin is allowed to move `from` into, for this order's
 * delivery type. Used to render only valid status-change buttons in the
 * order detail screen.
 *
 * `shipped` ("handed to a courier for a regional delivery") is meaningful
 * only for delivery orders — shared's canTransition graph technically allows
 * confirmed -> shipped regardless of delivery type, so it is filtered out
 * here explicitly for pickup. Pickup orders additionally allow
 * confirmed -> delivered directly (handed over at the counter, no courier
 * hop at all) — that carve-out already lives in canTransition. */
export function allowedNextStatuses(from: OrderStatus, deliveryType: DeliveryType): OrderStatus[] {
  return ALL_STATUSES.filter((to) => {
    if (to === from) return false;
    if (to === 'shipped' && deliveryType !== 'delivery') return false;
    return canTransition(from, to, deliveryType);
  });
}
