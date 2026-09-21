import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getProductSoldCount,
  getVariantStock,
  insertBrand,
  insertCategory,
  insertProductWithVariants,
  insertUser,
  setSettings,
} from './helpers/fixtures.ts';
import { createPgTestDb, type PgTestDb } from './helpers/pgDb.ts';
import {
  callCreateOrder,
  callSetOrderStatus,
  type CreateOrderPayload,
  type CreateOrderResult,
  type SetOrderStatusResult,
} from './helpers/rpc.ts';

// Real-Postgres only: PGlite is single-connection, so it cannot exercise row
// locking. Skipped unless TEST_DATABASE_URL is set (CI provides a service).
const DATABASE_URL = process.env.TEST_DATABASE_URL;

const USER_ID = 3000;
const OTHER_USER_ID = 3001;
const ADMIN_ID = 3002;
const PRICE = 50000;
const STOCK_RACE_STOCK = 5;
const STOCK_RACE_CALLERS = 20;
const SAME_KEY_CALLERS = 10;
const DEADLOCK_ROUNDS = 25;
const DEADLOCK_CALLERS_PER_ROUND = 8;
const PG_DEADLOCK_CODE = '40P01';

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

function fulfilled<T>(results: PromiseSettledResult<T>[]): T[] {
  return results.map((r) => {
    if (r.status === 'rejected') {
      throw r.reason;
    }
    return r.value;
  });
}

describe.skipIf(!DATABASE_URL)('create_order concurrency (real Postgres)', () => {
  let db: PgTestDb;
  let brandId: number;
  let categoryId: number;

  beforeAll(async () => {
    db = await createPgTestDb(DATABASE_URL!);
    await insertUser(db, USER_ID);
    await insertUser(db, OTHER_USER_ID, 'Boshqa mijoz');
    brandId = await insertBrand(db);
    categoryId = await insertCategory(db);
    await setSettings(db, { minOrderAmount: 0, freeDeliveryThreshold: 1000000, deliveryEnabled: true });
  });

  afterAll(async () => {
    await db.close();
  });

  async function product(stock: number, variantCount = 1) {
    return insertProductWithVariants(db, {
      name: `Concurrent ${randomUUID()}`,
      brandId,
      categoryId,
      variants: Array.from({ length: variantCount }, (_, i) => ({
        colorName: `Rang ${i}`,
        storageGb: 128,
        price: PRICE,
        stock,
      })),
    });
  }

  it('stock race: N callers for K units yield exactly K orders and the rest stock_changed', async () => {
    const { productId, variantIds } = await product(STOCK_RACE_STOCK);
    const variantId = variantIds[0]!;

    const results = fulfilled(
      await Promise.allSettled(
        Array.from({ length: STOCK_RACE_CALLERS }, () =>
          callCreateOrder(
            db,
            USER_ID,
            basePayload({ items: [{ variant_id: variantId, qty: 1, expected_price: PRICE }] }),
          ),
        ),
      ),
    );

    const ok = results.filter((r) => r.ok);
    const failed = results.filter((r): r is Extract<CreateOrderResult, { ok: false }> => !r.ok);
    expect(ok).toHaveLength(STOCK_RACE_STOCK);
    expect(failed).toHaveLength(STOCK_RACE_CALLERS - STOCK_RACE_STOCK);
    expect(failed.every((r) => r.code === 'stock_changed')).toBe(true);

    expect(await getVariantStock(db, variantId)).toBe(0);
    expect(await getProductSoldCount(db, productId)).toBe(STOCK_RACE_STOCK);

    const rows = await db.query<{ n: number }>(
      `select count(distinct oi.order_id)::int as n
         from public.order_items oi
        where oi.variant_id = $1`,
      [variantId],
    );
    expect(rows.rows[0]!.n).toBe(STOCK_RACE_STOCK);
  });

  it('same idempotency_key racing: exactly one order, the rest duplicate:true, stock drops once', async () => {
    const { variantIds } = await product(100);
    const variantId = variantIds[0]!;
    const key = randomUUID();

    const results = fulfilled(
      await Promise.allSettled(
        Array.from({ length: SAME_KEY_CALLERS }, () =>
          callCreateOrder(
            db,
            USER_ID,
            basePayload({
              idempotency_key: key,
              items: [{ variant_id: variantId, qty: 1, expected_price: PRICE }],
            }),
          ),
        ),
      ),
    );

    const oks = results.map((r) => {
      if (!r.ok) throw new Error(`unexpected failure: ${r.code}`);
      return r;
    });
    expect(oks.filter((r) => !r.duplicate)).toHaveLength(1);
    expect(oks.filter((r) => r.duplicate)).toHaveLength(SAME_KEY_CALLERS - 1);
    expect(new Set(oks.map((r) => r.order_id)).size).toBe(1);

    expect(await getVariantStock(db, variantId)).toBe(99);
    const count = await db.query<{ n: number }>(
      'select count(*)::int as n from public.orders where idempotency_key = $1',
      [key],
    );
    expect(count.rows[0]!.n).toBe(1);
  });

  it('same idempotency_key from a different user is rejected, never returned as a duplicate', async () => {
    const { variantIds } = await product(10);
    const variantId = variantIds[0]!;
    const key = randomUUID();
    const payload = basePayload({
      idempotency_key: key,
      items: [{ variant_id: variantId, qty: 1, expected_price: PRICE }],
    });

    const settled = await Promise.allSettled([
      callCreateOrder(db, USER_ID, payload),
      callCreateOrder(db, OTHER_USER_ID, payload),
    ]);

    const okCount = settled.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
    const rejected = settled.filter((r) => r.status === 'rejected');
    expect(okCount).toBe(1);
    expect(rejected).toHaveLength(1);
    expect(await getVariantStock(db, variantId)).toBe(9);
  });

  it('opposite item order across concurrent orders never deadlocks (locks taken in variant_id order)', async () => {
    const { variantIds } = await product(1_000_000, 2);
    const [a, b] = variantIds as [number, number];
    const forward = [
      { variant_id: a, qty: 1, expected_price: PRICE },
      { variant_id: b, qty: 1, expected_price: PRICE },
    ];
    const backward = [...forward].reverse();

    let total = 0;
    for (let round = 0; round < DEADLOCK_ROUNDS; round++) {
      const settled = await Promise.allSettled(
        Array.from({ length: DEADLOCK_CALLERS_PER_ROUND }, (_, i) =>
          callCreateOrder(db, USER_ID, basePayload({ items: i % 2 === 0 ? forward : backward })),
        ),
      );
      for (const r of settled) {
        if (r.status === 'rejected') {
          const code = (r.reason as { code?: string }).code;
          expect(code, 'deadlock detected').not.toBe(PG_DEADLOCK_CODE);
          throw r.reason;
        }
        expect(r.value.ok).toBe(true);
        total++;
      }
    }

    expect(await getVariantStock(db, a)).toBe(1_000_000 - total);
    expect(await getVariantStock(db, b)).toBe(1_000_000 - total);
  });

  it('concurrent set_order_status on one order: exactly one transition wins', async () => {
    const { variantIds } = await product(10);
    const created = await callCreateOrder(
      db,
      USER_ID,
      basePayload({ items: [{ variant_id: variantIds[0]!, qty: 1, expected_price: PRICE }] }),
    );
    if (!created.ok) throw new Error('expected ok');

    const [confirmSettled, cancelSettled] = await Promise.allSettled([
      callSetOrderStatus(db, created.order_id, 'confirmed', ADMIN_ID),
      callSetOrderStatus(db, created.order_id, 'cancelled', ADMIN_ID),
    ]);
    const [toConfirmed, toCancelled] = [confirmSettled, cancelSettled].map((r) => {
      if (r.status === 'rejected') throw r.reason;
      return r.value;
    }) as [SetOrderStatusResult, SetOrderStatusResult];

    // new -> confirmed and new -> cancelled are both legal from `new`, and
    // confirmed -> cancelled is legal too, so both may succeed only in that
    // one order (confirmed first, then cancelled). Cancelled first makes the
    // confirm illegal (terminal state). Either way the history must be a
    // valid chain and stock must be restored at most once.
    const final = await db.query<{ status: string }>('select status from public.orders where id = $1', [
      created.order_id,
    ]);
    const finalStatus = final.rows[0]!.status;

    if (toCancelled.ok && !toConfirmed.ok) {
      expect(toConfirmed.code).toBe('invalid_transition');
      expect(finalStatus).toBe('cancelled');
    } else if (toConfirmed.ok && toCancelled.ok) {
      expect(toConfirmed.from).toBe('new');
      expect(toCancelled.from).toBe('confirmed');
      expect(finalStatus).toBe('cancelled');
    } else {
      expect(toConfirmed.ok).toBe(true);
      expect(finalStatus).toBe('confirmed');
    }

    if (finalStatus === 'cancelled') {
      expect(await getVariantStock(db, variantIds[0]!)).toBe(10);
    } else {
      expect(await getVariantStock(db, variantIds[0]!)).toBe(9);
    }
  });
});
