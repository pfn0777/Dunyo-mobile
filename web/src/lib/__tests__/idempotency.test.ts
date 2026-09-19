// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getOrCreateIdempotencyKey } from '../idempotency.ts';
import type { CartLine } from '../cart.ts';

const LINE: CartLine = {
  variantId: 1,
  productId: 101,
  qty: 2,
  price: 1000,
  oldPrice: null,
  name: 'A',
  colorName: 'Black',
  storageGb: 128,
  thumb: null,
  stock: 5,
};

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('getOrCreateIdempotencyKey', () => {
  it('returns the same key for the same cart state', () => {
    const first = getOrCreateIdempotencyKey([LINE]);
    const second = getOrCreateIdempotencyKey([LINE]);
    expect(first).toBe(second);
  });

  it('regenerates the key when the cart changes', () => {
    const first = getOrCreateIdempotencyKey([LINE]);
    const changed = getOrCreateIdempotencyKey([{ ...LINE, qty: 3 }]);
    expect(first).not.toBe(changed);
  });
});
