import type { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from './helpers/db.ts';
import {
  getProductSoldCount,
  getVariantStock,
  insertBrand,
  insertCategory,
  insertProductWithVariants,
  insertRegion,
  insertUser,
  setSettings,
} from './helpers/fixtures.ts';
import { callCreateOrder, callSetOrderStatus, type CreateOrderPayload } from './helpers/rpc.ts';

const USER_ID = 2000;
const ADMIN_ID = 2001;

function basePayload(overrides: Partial<CreateOrderPayload> = {}): CreateOrderPayload {
  return {
    idempotency_key: randomUUID(),
    delivery_type: 'delivery',
    customer_name: 'Ali',
    customer_phone: '+998901234567',
    payment_method: 'cash',
    items: [],
    ...overrides,
  };
}

describe('set_order_status', () => {
  let db: PGlite;
  let brandId: number;
  let categoryId: number;
  let regionId: number;

  beforeAll(async () => {
    db = await createTestDb();
    await insertUser(db, USER_ID);
    brandId = await insertBrand(db);
    categoryId = await insertCategory(db);
    regionId = await insertRegion(db);
    await setSettings(db, { minOrderAmount: 0, freeDeliveryThreshold: 1000000, deliveryEnabled: true });
  });

  afterAll(async () => {
    await db.close();
  });

  async function newOrder(
    deliveryType: 'delivery' | 'pickup' = 'delivery',
  ): Promise<{ orderId: number; productId: number; variantId: number }> {
    const { productId, variantIds } = await insertProductWithVariants(db, {
      name: `SOS product ${randomUUID()}`,
      brandId,
      categoryId,
      variants: [{ colorName: 'Qora', storageGb: 128, price: 50000, stock: 10 }],
    });
    const variantId = variantIds[0]!;
    const result = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        delivery_type: deliveryType,
        region_id: deliveryType === 'delivery' ? regionId : undefined,
        address_text: deliveryType === 'delivery' ? 'Bukhara' : undefined,
        items: [{ variant_id: variantId, qty: 3, expected_price: 50000 }],
      }),
    );
    if (!result.ok) throw new Error(`setup failed: ${JSON.stringify(result)}`);
    return { orderId: result.order_id, productId, variantId };
  }

  async function newTwoVariantOrder(): Promise<{
    orderId: number;
    productId: number;
    variantA: number;
    variantB: number;
  }> {
    const { productId, variantIds } = await insertProductWithVariants(db, {
      name: `SOS two-variant product ${randomUUID()}`,
      brandId,
      categoryId,
      variants: [
        { colorName: 'Qora', storageGb: 128, price: 60000, stock: 10 },
        { colorName: 'Oq', storageGb: 256, price: 70000, stock: 10 },
      ],
    });
    const variantA = variantIds[0]!;
    const variantB = variantIds[1]!;
    const result = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        delivery_type: 'pickup',
        items: [
          { variant_id: variantA, qty: 2, expected_price: 60000 },
          { variant_id: variantB, qty: 1, expected_price: 70000 },
        ],
      }),
    );
    if (!result.ok) throw new Error(`setup failed: ${JSON.stringify(result)}`);
    return { orderId: result.order_id, productId, variantA, variantB };
  }

  it('allows every documented transition: pickup confirmed -> delivered, and the full delivery flow confirmed -> shipped -> on_the_way -> delivered', async () => {
    const { orderId: pickupOrderId } = await newOrder('pickup');
    await callSetOrderStatus(db, pickupOrderId, 'confirmed', ADMIN_ID);
    const pickupHandover = await callSetOrderStatus(db, pickupOrderId, 'delivered', ADMIN_ID);
    expect(pickupHandover).toMatchObject({ ok: true, from: 'confirmed', to: 'delivered' });

    const { orderId } = await newOrder('delivery');
    const toConfirmed = await callSetOrderStatus(db, orderId, 'confirmed', ADMIN_ID);
    expect(toConfirmed).toMatchObject({ ok: true, from: 'new', to: 'confirmed' });

    const toShipped = await callSetOrderStatus(db, orderId, 'shipped', ADMIN_ID);
    expect(toShipped).toMatchObject({ ok: true, from: 'confirmed', to: 'shipped' });

    const toOnTheWay = await callSetOrderStatus(db, orderId, 'on_the_way', ADMIN_ID);
    expect(toOnTheWay).toMatchObject({ ok: true, from: 'shipped', to: 'on_the_way' });

    const toDelivered = await callSetOrderStatus(db, orderId, 'delivered', ADMIN_ID);
    expect(toDelivered).toMatchObject({ ok: true, from: 'on_the_way', to: 'delivered' });
  });

  it('rejects confirmed -> delivered for a delivery (non-pickup) order', async () => {
    const { orderId } = await newOrder('delivery');
    await callSetOrderStatus(db, orderId, 'confirmed', ADMIN_ID);

    const result = await callSetOrderStatus(db, orderId, 'delivered', ADMIN_ID);
    expect(result).toEqual({ ok: false, code: 'invalid_transition', from: 'confirmed', to: 'delivered' });
  });

  it('rejects delivered -> new, cancelled -> cancelled, and cancelled -> confirmed', async () => {
    const { orderId } = await newOrder('delivery');
    await callSetOrderStatus(db, orderId, 'confirmed', ADMIN_ID);
    await callSetOrderStatus(db, orderId, 'shipped', ADMIN_ID);
    await callSetOrderStatus(db, orderId, 'on_the_way', ADMIN_ID);
    await callSetOrderStatus(db, orderId, 'delivered', ADMIN_ID);

    const deliveredToNew = await callSetOrderStatus(db, orderId, 'new', ADMIN_ID);
    expect(deliveredToNew).toEqual({ ok: false, code: 'invalid_transition', from: 'delivered', to: 'new' });

    const { orderId: cancelledOrderId } = await newOrder('delivery');
    await callSetOrderStatus(db, cancelledOrderId, 'cancelled', ADMIN_ID);

    const cancelledToCancelled = await callSetOrderStatus(db, cancelledOrderId, 'cancelled', ADMIN_ID);
    expect(cancelledToCancelled).toEqual({
      ok: false,
      code: 'invalid_transition',
      from: 'cancelled',
      to: 'cancelled',
    });

    const cancelledToConfirmed = await callSetOrderStatus(db, cancelledOrderId, 'confirmed', ADMIN_ID);
    expect(cancelledToConfirmed).toEqual({
      ok: false,
      code: 'invalid_transition',
      from: 'cancelled',
      to: 'confirmed',
    });
  });

  it('cancel restores variant stock and decrements sold_count exactly once; cancelling twice does not restore stock twice', async () => {
    const { orderId, productId, variantId } = await newOrder('delivery');
    expect(await getVariantStock(db, variantId)).toBe(7); // 10 - 3
    expect(await getProductSoldCount(db, productId)).toBe(3);

    const cancel1 = await callSetOrderStatus(db, orderId, 'cancelled', ADMIN_ID);
    expect(cancel1).toMatchObject({ ok: true, from: 'new', to: 'cancelled' });

    expect(await getVariantStock(db, variantId)).toBe(10);
    expect(await getProductSoldCount(db, productId)).toBe(0);

    const cancel2 = await callSetOrderStatus(db, orderId, 'cancelled', ADMIN_ID);
    expect(cancel2).toEqual({ ok: false, code: 'invalid_transition', from: 'cancelled', to: 'cancelled' });

    expect(await getVariantStock(db, variantId)).toBe(10);
    expect(await getProductSoldCount(db, productId)).toBe(0);
  });

  it('cancelling an order with two variants of the same product restores both variants and sums sold_count correctly (the aggregation trap)', async () => {
    const { orderId, productId, variantA, variantB } = await newTwoVariantOrder();

    expect(await getVariantStock(db, variantA)).toBe(8); // 10 - 2
    expect(await getVariantStock(db, variantB)).toBe(9); // 10 - 1
    expect(await getProductSoldCount(db, productId)).toBe(3); // 2 + 1

    await callSetOrderStatus(db, orderId, 'cancelled', ADMIN_ID);

    expect(await getVariantStock(db, variantA)).toBe(10);
    expect(await getVariantStock(db, variantB)).toBe(10);
    expect(await getProductSoldCount(db, productId)).toBe(0);
  });

  it('tracking_note is written on shipped, and a later status change without a note does not erase it', async () => {
    const { orderId } = await newOrder('delivery');
    await callSetOrderStatus(db, orderId, 'confirmed', ADMIN_ID);
    await callSetOrderStatus(db, orderId, 'shipped', ADMIN_ID, "Kuryer yo'lda, ertaga yetkaziladi");

    const afterShip = await db.query<{ tracking_note: string | null }>(
      'select tracking_note from public.orders where id = $1',
      [orderId],
    );
    expect(afterShip.rows[0]!.tracking_note).toBe("Kuryer yo'lda, ertaga yetkaziladi");

    await callSetOrderStatus(db, orderId, 'on_the_way', ADMIN_ID);

    const afterOnTheWay = await db.query<{ tracking_note: string | null }>(
      'select tracking_note from public.orders where id = $1',
      [orderId],
    );
    expect(afterOnTheWay.rows[0]!.tracking_note).toBe("Kuryer yo'lda, ertaga yetkaziladi");
  });

  it('writes order_status_history and audit_log rows on every successful transition', async () => {
    const { orderId } = await newOrder('delivery');
    await callSetOrderStatus(db, orderId, 'confirmed', ADMIN_ID);
    await callSetOrderStatus(db, orderId, 'shipped', ADMIN_ID);

    const history = await db.query(
      'select from_status, to_status, changed_by from public.order_status_history where order_id = $1 order by id',
      [orderId],
    );
    expect(history.rows).toEqual([
      { from_status: null, to_status: 'new', changed_by: USER_ID },
      { from_status: 'new', to_status: 'confirmed', changed_by: ADMIN_ID },
      { from_status: 'confirmed', to_status: 'shipped', changed_by: ADMIN_ID },
    ]);

    const audit = await db.query(
      "select action, entity, entity_id from public.audit_log where entity = 'orders' and entity_id = $1 order by id",
      [orderId],
    );
    expect(audit.rows).toEqual([
      { action: 'order_status', entity: 'orders', entity_id: orderId },
      { action: 'order_status', entity: 'orders', entity_id: orderId },
    ]);
  });

  it('a non-existent order id raises', async () => {
    await expect(callSetOrderStatus(db, 9999999, 'confirmed', ADMIN_ID)).rejects.toThrow();
  });
});
