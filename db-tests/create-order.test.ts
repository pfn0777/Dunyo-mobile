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
  setProductActive,
  setSettings,
  setVariantActive,
} from './helpers/fixtures.ts';
import { callCreateOrder, type CreateOrderPayload } from './helpers/rpc.ts';

const USER_ID = 1000;
const OTHER_USER_ID = 1001;

function basePayload(overrides: Partial<CreateOrderPayload> = {}): CreateOrderPayload {
  return {
    idempotency_key: randomUUID(),
    delivery_type: 'pickup',
    customer_name: 'Ali Valiyev',
    customer_phone: '+998901234567',
    payment_method: 'cash',
    items: [],
    ...overrides,
  };
}

describe('create_order', () => {
  let db: PGlite;
  let brandId: number;
  let categoryId: number;

  beforeAll(async () => {
    db = await createTestDb();
    await insertUser(db, USER_ID);
    await insertUser(db, OTHER_USER_ID, 'Boshqa mijoz');
    brandId = await insertBrand(db);
    categoryId = await insertCategory(db);
    await setSettings(db, { minOrderAmount: 0, freeDeliveryThreshold: 1000000, deliveryEnabled: true });
  });

  afterAll(async () => {
    await db.close();
  });

  async function singleVariant(
    price: number,
    stock: number,
    opts: Partial<{ oldPrice: number | null; isActive: boolean; name: string }> = {},
  ): Promise<{ productId: number; variantId: number }> {
    const { productId, variantIds } = await insertProductWithVariants(db, {
      name: opts.name ?? `Product ${randomUUID()}`,
      brandId,
      categoryId,
      isActive: opts.isActive ?? true,
      variants: [
        {
          colorName: 'Qora',
          storageGb: 128,
          price,
          oldPrice: opts.oldPrice ?? null,
          stock,
        },
      ],
    });
    return { productId, variantId: variantIds[0]! };
  }

  it('happy path: decrements the right variant, increments sold_count, snapshots color/storage/warranty, order_no looks like DM-000001', async () => {
    const { productId, variantId } = await singleVariant(500000, 5, { name: 'iPhone Test A' });

    const result = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        items: [{ variant_id: variantId, qty: 2, expected_price: 500000 }],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.duplicate).toBe(false);
    expect(result.order_no).toMatch(/^DM-\d{6}$/);
    expect(result.items_total).toBe(1000000);

    expect(await getVariantStock(db, variantId)).toBe(3);
    expect(await getProductSoldCount(db, productId)).toBe(2);

    const item = await db.query<{
      color_snapshot: string;
      storage_snapshot: number;
      warranty_snapshot: number;
    }>(
      'select color_snapshot, storage_snapshot, warranty_snapshot from public.order_items where order_id = $1',
      [result.order_id],
    );
    expect(item.rows[0]).toEqual({ color_snapshot: 'Qora', storage_snapshot: 128, warranty_snapshot: 12 });
  });

  it('never trusts the payload expected_price: a wrong expected_price returns price_changed, and a tampered payload can never lower the charged total', async () => {
    const { variantId } = await singleVariant(700000, 10);

    const tampered = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        items: [{ variant_id: variantId, qty: 1, expected_price: 1, price: 1 } as never],
      }),
    );
    expect(tampered.ok).toBe(false);
    if (tampered.ok) throw new Error('expected failure');
    expect(tampered.code).toBe('price_changed');
    if (tampered.code === 'price_changed') {
      expect(tampered.items).toEqual([{ variant_id: variantId, price: 700000 }]);
    }

    // A subsequent order with the correct (server-side) price is charged
    // the real price, never the tampered one -- no order was ever created
    // at the tampered price above.
    const real = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        items: [{ variant_id: variantId, qty: 1, expected_price: 700000 }],
      }),
    );
    expect(real.ok).toBe(true);
    if (!real.ok) throw new Error('expected ok');
    expect(real.items_total).toBe(700000);
  });

  it('insufficient stock returns stock_changed with available, and nothing is written', async () => {
    const { variantId } = await singleVariant(50000, 1);
    const before = await getVariantStock(db, variantId);
    const ordersBefore = await db.query<{ n: number }>('select count(*)::int as n from public.orders');

    const result = await callCreateOrder(
      db,
      USER_ID,
      basePayload({ items: [{ variant_id: variantId, qty: 5, expected_price: 50000 }] }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.code).toBe('stock_changed');
    if (result.code === 'stock_changed') {
      expect(result.items).toEqual([{ variant_id: variantId, available: 1 }]);
    }

    expect(await getVariantStock(db, variantId)).toBe(before);
    const ordersAfter = await db.query<{ n: number }>('select count(*)::int as n from public.orders');
    expect(ordersAfter.rows[0]).toEqual(ordersBefore.rows[0]);
  });

  it('inactive variant returns stock_changed', async () => {
    const { variantId } = await singleVariant(50000, 10);
    await setVariantActive(db, variantId, false);
    const result = await callCreateOrder(
      db,
      USER_ID,
      basePayload({ items: [{ variant_id: variantId, qty: 1, expected_price: 50000 }] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.code).toBe('stock_changed');
  });

  it('inactive parent product returns stock_changed', async () => {
    const { productId, variantId } = await singleVariant(50000, 10);
    await setProductActive(db, productId, false);
    const result = await callCreateOrder(
      db,
      USER_ID,
      basePayload({ items: [{ variant_id: variantId, qty: 1, expected_price: 50000 }] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.code).toBe('stock_changed');
  });

  it('the same idempotency_key twice creates exactly one order; the second call reports duplicate:true', async () => {
    const { variantId } = await singleVariant(50000, 10);
    const key = randomUUID();
    const first = await callCreateOrder(
      db,
      USER_ID,
      basePayload({ idempotency_key: key, items: [{ variant_id: variantId, qty: 1, expected_price: 50000 }] }),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('expected ok');
    expect(first.duplicate).toBe(false);

    const second = await callCreateOrder(
      db,
      USER_ID,
      basePayload({ idempotency_key: key, items: [{ variant_id: variantId, qty: 1, expected_price: 50000 }] }),
    );
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('expected ok');
    expect(second.duplicate).toBe(true);
    expect(second.order_id).toBe(first.order_id);

    expect(await getVariantStock(db, variantId)).toBe(9);

    const count = await db.query<{ n: number }>(
      'select count(*)::int as n from public.orders where idempotency_key = $1',
      [key],
    );
    expect(count.rows[0]!.n).toBe(1);
  });

  it('two variants of the same product in one order: both stocks decrement correctly and sold_count increases by the sum', async () => {
    const { productId, variantIds } = await insertProductWithVariants(db, {
      name: `Two-variant product ${randomUUID()}`,
      brandId,
      categoryId,
      variants: [
        { colorName: 'Qora', storageGb: 128, price: 100000, stock: 5 },
        { colorName: 'Oq', storageGb: 256, price: 120000, stock: 5 },
      ],
    });
    const blackId = variantIds[0]!;
    const whiteId = variantIds[1]!;

    const result = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        items: [
          { variant_id: blackId, qty: 2, expected_price: 100000 },
          { variant_id: whiteId, qty: 1, expected_price: 120000 },
        ],
      }),
    );
    expect(result.ok).toBe(true);

    expect(await getVariantStock(db, blackId)).toBe(3);
    expect(await getVariantStock(db, whiteId)).toBe(4);
    expect(await getProductSoldCount(db, productId)).toBe(3);
  });

  it('rejects duplicate variant_id lines in one payload', async () => {
    const { variantId } = await singleVariant(50000, 10);
    await expect(
      callCreateOrder(
        db,
        USER_ID,
        basePayload({
          items: [
            { variant_id: variantId, qty: 1, expected_price: 50000 },
            { variant_id: variantId, qty: 1, expected_price: 50000 },
          ],
        }),
      ),
    ).rejects.toThrow();
  });

  it('rejects orders below the minimum order amount', async () => {
    await setSettings(db, { minOrderAmount: 200000 });
    const { variantId } = await singleVariant(50000, 10);
    const result = await callCreateOrder(
      db,
      USER_ID,
      basePayload({ items: [{ variant_id: variantId, qty: 1, expected_price: 50000 }] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.code).toBe('min_order');
    if (result.code === 'min_order') {
      expect(result.min_order_amount).toBe(200000);
      expect(result.items_total).toBe(50000);
    }
    await setSettings(db, { minOrderAmount: 0 });
  });

  it('rejects delivery when delivery is disabled', async () => {
    await setSettings(db, { deliveryEnabled: false });
    const region = await insertRegion(db);
    const { variantId } = await singleVariant(50000, 10);
    const result = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        delivery_type: 'delivery',
        region_id: region,
        address_text: 'addr',
        items: [{ variant_id: variantId, qty: 1, expected_price: 50000 }],
      }),
    );
    expect(result).toEqual({ ok: false, code: 'delivery_disabled' });
    await setSettings(db, { deliveryEnabled: true });
  });

  it('region_invalid: missing region_id, inactive region, non-existent region', async () => {
    const { variantId } = await singleVariant(50000, 10);

    const missing = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        delivery_type: 'delivery',
        address_text: 'addr',
        items: [{ variant_id: variantId, qty: 1, expected_price: 50000 }],
      }),
    );
    expect(missing).toEqual({ ok: false, code: 'region_invalid' });

    const inactiveRegion = await insertRegion(db, { isActive: false });
    const inactive = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        delivery_type: 'delivery',
        region_id: inactiveRegion,
        address_text: 'addr',
        items: [{ variant_id: variantId, qty: 1, expected_price: 50000 }],
      }),
    );
    expect(inactive).toEqual({ ok: false, code: 'region_invalid' });

    const nonExistent = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        delivery_type: 'delivery',
        region_id: 999999,
        address_text: 'addr',
        items: [{ variant_id: variantId, qty: 1, expected_price: 50000 }],
      }),
    );
    expect(nonExistent).toEqual({ ok: false, code: 'region_invalid' });
  });

  it('delivery fee: region fee below threshold, waived at/above threshold, region free-threshold override beats the global, pickup is always free and stores region_id null', async () => {
    const region = await insertRegion(db, { deliveryFee: 30000, freeDeliveryThreshold: 100000 });

    const { variantId: cheapVariant } = await singleVariant(50000, 10);
    const below = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        delivery_type: 'delivery',
        region_id: region,
        address_text: 'addr',
        items: [{ variant_id: cheapVariant, qty: 1, expected_price: 50000 }],
      }),
    );
    expect(below.ok).toBe(true);
    if (!below.ok) throw new Error('expected ok');
    expect(below.delivery_fee).toBe(30000); // below the region's own free threshold (100000)

    const { variantId: expensiveVariant } = await singleVariant(150000, 10);
    const atThreshold = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        delivery_type: 'delivery',
        region_id: region,
        address_text: 'addr',
        items: [{ variant_id: expensiveVariant, qty: 1, expected_price: 150000 }],
      }),
    );
    expect(atThreshold.ok).toBe(true);
    if (!atThreshold.ok) throw new Error('expected ok');
    // 150000 >= region's free threshold (100000), which overrides the
    // global freeDeliveryThreshold of 1000000 set in beforeAll.
    expect(atThreshold.delivery_fee).toBe(0);

    const { variantId: pickupVariant } = await singleVariant(50000, 10);
    const pickup = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        delivery_type: 'pickup',
        items: [{ variant_id: pickupVariant, qty: 1, expected_price: 50000 }],
      }),
    );
    expect(pickup.ok).toBe(true);
    if (!pickup.ok) throw new Error('expected ok');
    expect(pickup.delivery_fee).toBe(0);

    const orderRow = await db.query<{ region_id: number | null }>(
      'select region_id from public.orders where id = $1',
      [pickup.order_id],
    );
    expect(orderRow.rows[0]!.region_id).toBeNull();
  });

  it('installment_request sets installment_months from settings, payment_status stays unpaid, and totals do not change vs cash', async () => {
    await setSettings(db, { installmentMonths: 12 });
    const { variantId: cashVariant } = await singleVariant(400000, 10);
    const { variantId: installmentVariant } = await singleVariant(400000, 10);

    const cash = await callCreateOrder(
      db,
      USER_ID,
      basePayload({ payment_method: 'cash', items: [{ variant_id: cashVariant, qty: 1, expected_price: 400000 }] }),
    );
    const installment = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        payment_method: 'installment_request',
        items: [{ variant_id: installmentVariant, qty: 1, expected_price: 400000 }],
      }),
    );

    expect(cash.ok).toBe(true);
    expect(installment.ok).toBe(true);
    if (!cash.ok || !installment.ok) throw new Error('expected ok');
    expect(installment.grand_total).toBe(cash.grand_total);
    expect(installment.items_total).toBe(cash.items_total);

    const row = await db.query<{ installment_months: number | null; payment_status: string }>(
      'select installment_months, payment_status from public.orders where id = $1',
      [installment.order_id],
    );
    expect(row.rows[0]).toEqual({ installment_months: 12, payment_status: 'unpaid' });
  });

  it('accepts a correctly formatted +998 phone number and rejects malformed ones', async () => {
    const { variantId: okVariant } = await singleVariant(50000, 10);
    const ok = await callCreateOrder(
      db,
      USER_ID,
      basePayload({
        customer_phone: '+998901234567',
        items: [{ variant_id: okVariant, qty: 1, expected_price: 50000 }],
      }),
    );
    expect(ok.ok).toBe(true);

    const { variantId: badVariant1 } = await singleVariant(50000, 10);
    await expect(
      callCreateOrder(
        db,
        USER_ID,
        basePayload({
          customer_phone: '901234567',
          items: [{ variant_id: badVariant1, qty: 1, expected_price: 50000 }],
        }),
      ),
    ).rejects.toThrow();

    const { variantId: badVariant2 } = await singleVariant(50000, 10);
    await expect(
      callCreateOrder(
        db,
        USER_ID,
        basePayload({
          customer_phone: '+79001234567',
          items: [{ variant_id: badVariant2, qty: 1, expected_price: 50000 }],
        }),
      ),
    ).rejects.toThrow();
  });

  it(
    'a second order against a stock=1 variant sees the decremented stock and gets stock_changed ' +
      '(PGlite is single-connection, so this proves sequential consistency after a committed order, not a true concurrent race)',
    async () => {
      const { variantId } = await singleVariant(50000, 1);

      const first = await callCreateOrder(
        db,
        USER_ID,
        basePayload({ items: [{ variant_id: variantId, qty: 1, expected_price: 50000 }] }),
      );
      expect(first.ok).toBe(true);

      const second = await callCreateOrder(
        db,
        OTHER_USER_ID,
        basePayload({ items: [{ variant_id: variantId, qty: 1, expected_price: 50000 }] }),
      );
      expect(second.ok).toBe(false);
      if (second.ok) throw new Error('expected failure');
      expect(second.code).toBe('stock_changed');
      if (second.code === 'stock_changed') {
        expect(second.items).toEqual([{ variant_id: variantId, available: 0 }]);
      }
    },
  );
});
