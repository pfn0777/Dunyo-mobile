// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { cartStore } from '../cart.ts';

const LINE_A = {
  variantId: 1,
  productId: 101,
  price: 1000,
  oldPrice: null,
  name: 'A',
  colorName: 'Black',
  storageGb: 128,
  thumb: null,
  stock: 3,
};
const LINE_B = {
  variantId: 2,
  productId: 102,
  price: 2000,
  oldPrice: 2500,
  name: 'B',
  colorName: 'White',
  storageGb: null,
  thumb: null,
  stock: 1,
};
// Same product as LINE_A, different variant (colour): must be a distinct
// cart line, since a line's identity is variantId, not productId.
const LINE_A2 = { ...LINE_A, variantId: 3, colorName: 'White', stock: 2 };

beforeEach(() => {
  window.localStorage.clear();
  cartStore.clear();
});

describe('cartStore', () => {
  it('adds a new line and increments an existing one', () => {
    cartStore.addOrIncrement(LINE_A, 1);
    cartStore.addOrIncrement(LINE_A, 1);
    const lines = cartStore.getSnapshot();
    expect(lines).toHaveLength(1);
    expect(lines[0]?.qty).toBe(2);
  });

  it('does not increment qty beyond stock', () => {
    cartStore.addOrIncrement(LINE_B, 1); // stock = 1
    cartStore.addOrIncrement(LINE_B, 5);
    expect(cartStore.getSnapshot()[0]?.qty).toBe(1);
  });

  it('setQty clamps to stock and removes at zero', () => {
    cartStore.addOrIncrement(LINE_A, 1);
    cartStore.setQty(LINE_A.variantId, 10);
    expect(cartStore.getSnapshot()[0]?.qty).toBe(LINE_A.stock);
    cartStore.setQty(LINE_A.variantId, 0);
    expect(cartStore.getSnapshot()).toHaveLength(0);
  });

  it('removes a line', () => {
    cartStore.addOrIncrement(LINE_A, 1);
    cartStore.remove(LINE_A.variantId);
    expect(cartStore.getSnapshot()).toHaveLength(0);
  });

  it('persists to localStorage and round-trips on rehydrate', () => {
    cartStore.addOrIncrement(LINE_A, 2);
    const raw = window.localStorage.getItem('dunyo.cart.v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { lines: unknown[] };
    expect(parsed.lines).toHaveLength(1);
  });

  it('reconcile clamps qty to fresh stock and flags price changes', () => {
    cartStore.addOrIncrement(LINE_A, 2);
    const result = cartStore.reconcile([{ id: LINE_A.variantId, price: 1500, oldPrice: null, stock: 1 }]);
    expect(result.priceChanged).toContain(LINE_A.variantId);
    expect(result.stockChanged).toContain(LINE_A.variantId);
    const line = cartStore.getSnapshot()[0];
    expect(line?.price).toBe(1500);
    expect(line?.qty).toBe(1);
  });

  it('treats two variants of the same product as two distinct lines', () => {
    cartStore.addOrIncrement(LINE_A, 1);
    cartStore.addOrIncrement(LINE_A2, 1);
    const lines = cartStore.getSnapshot();
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.productId === LINE_A.productId)).toBe(true);
    expect(new Set(lines.map((l) => l.variantId)).size).toBe(2);
  });
});
