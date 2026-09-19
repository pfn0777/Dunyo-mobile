import { describe, expect, it } from 'vitest';
import { mapCheckoutError } from '../checkoutErrors.ts';

describe('mapCheckoutError', () => {
  it('maps stock_changed with its items', () => {
    const result = mapCheckoutError({
      status: 409,
      code: 'stock_changed',
      details: { items: [{ variant_id: 5, available: 0 }] },
    });
    expect(result).toEqual({ kind: 'stock_changed', items: [{ variant_id: 5, available: 0 }] });
  });

  it('maps price_changed with its items', () => {
    const result = mapCheckoutError({
      status: 409,
      code: 'price_changed',
      details: { items: [{ variant_id: 7, price: 12000 }] },
    });
    expect(result).toEqual({ kind: 'price_changed', items: [{ variant_id: 7, price: 12000 }] });
  });

  it('maps delivery_disabled', () => {
    expect(mapCheckoutError({ status: 422, code: 'delivery_disabled' })).toEqual({ kind: 'delivery_disabled' });
  });

  it('maps region_invalid', () => {
    expect(mapCheckoutError({ status: 422, code: 'region_invalid' })).toEqual({ kind: 'region_invalid' });
  });

  it('maps min_order with amounts', () => {
    const result = mapCheckoutError({
      status: 422,
      code: 'min_order',
      details: { min_order_amount: 50000, items_total: 20000 },
    });
    expect(result).toEqual({ kind: 'min_order', minOrderAmount: 50000, itemsTotal: 20000 });
  });

  it('falls back to generic for unknown codes', () => {
    expect(mapCheckoutError({ status: 500, code: 'internal' })).toEqual({ kind: 'generic' });
  });

  it('falls back to generic when details are malformed', () => {
    expect(mapCheckoutError({ status: 409, code: 'stock_changed', details: { items: 'nope' } })).toEqual({ kind: 'generic' });
  });
});
