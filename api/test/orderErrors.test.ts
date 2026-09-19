import { describe, expect, it } from 'vitest';
import { mapCreateOrderFailure, type CreateOrderRpcFailure } from '../src/lib/orderErrors';

describe('mapCreateOrderFailure', () => {
  it('delivery_disabled maps to 422 with no details', () => {
    const failure: CreateOrderRpcFailure = { ok: false, code: 'delivery_disabled' };
    const mapped = mapCreateOrderFailure(failure);
    expect(mapped.status).toBe(422);
    expect(mapped.code).toBe('delivery_disabled');
    expect(mapped.details).toBeUndefined();
  });

  it('region_invalid maps to 422 with no details', () => {
    const failure: CreateOrderRpcFailure = { ok: false, code: 'region_invalid' };
    const mapped = mapCreateOrderFailure(failure);
    expect(mapped.status).toBe(422);
    expect(mapped.code).toBe('region_invalid');
    expect(mapped.details).toBeUndefined();
  });

  it('stock_changed maps to 409 and preserves variant items', () => {
    const failure: CreateOrderRpcFailure = {
      ok: false,
      code: 'stock_changed',
      items: [{ variant_id: 7, available: 1 }],
    };
    const mapped = mapCreateOrderFailure(failure);
    expect(mapped.status).toBe(409);
    expect(mapped.code).toBe('stock_changed');
    expect(mapped.details).toBeDefined();
    const items = mapped.details!['items'] as Array<{ variant_id: number; available: number }>;
    expect(items[0]).toEqual({ variant_id: 7, available: 1 });
    expect('ok' in mapped.details!).toBe(false);
    expect('code' in mapped.details!).toBe(false);
  });

  it('price_changed maps to 409 and preserves variant items', () => {
    const failure: CreateOrderRpcFailure = {
      ok: false,
      code: 'price_changed',
      items: [{ variant_id: 3, price: 15000 }],
    };
    const mapped = mapCreateOrderFailure(failure);
    expect(mapped.status).toBe(409);
    const items = mapped.details!['items'] as Array<{ variant_id: number; price: number }>;
    expect(items[0]).toEqual({ variant_id: 3, price: 15000 });
  });

  it('min_order maps to 422 and preserves amounts', () => {
    const failure: CreateOrderRpcFailure = {
      ok: false,
      code: 'min_order',
      min_order_amount: 50000,
      items_total: 20000,
    };
    const mapped = mapCreateOrderFailure(failure);
    expect(mapped.status).toBe(422);
    expect(mapped.details!['min_order_amount']).toBe(50000);
    expect(mapped.details!['items_total']).toBe(20000);
  });
});
