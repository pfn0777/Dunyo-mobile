// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CartStore } from '../cart.ts';

interface MinimalTelegramWebApp {
  CloudStorage: {
    getItem(key: string, cb: (error: string | null, value?: string) => void): void;
    setItem(key: string, value: string, cb?: (error: string | null, ok?: boolean) => void): void;
  };
}

function mockTelegram(cloudValue: string | null): void {
  (window as unknown as { Telegram: { WebApp: MinimalTelegramWebApp } }).Telegram = {
    WebApp: {
      CloudStorage: {
        getItem: (_key, cb) => cb(null, cloudValue ?? undefined),
        setItem: (_key, _value, cb) => cb?.(null, true),
      },
    },
  };
}

const BASE_LINE = { productId: 1, qty: 1, price: 100, oldPrice: null, name: 'x', colorName: 'Black', storageGb: null, thumb: null, stock: 5 };

describe('cartStore.hydrate', () => {
  it('prefers the newer of localStorage and CloudStorage by updatedAt', async () => {
    window.localStorage.clear();
    const older = { lines: [{ ...BASE_LINE, variantId: 1, name: 'old' }], updatedAt: 1000 };
    const newer = { lines: [{ ...BASE_LINE, variantId: 2, name: 'new' }], updatedAt: 2000 };
    window.localStorage.setItem('dunyo.cart.v1', JSON.stringify(older));
    mockTelegram(JSON.stringify(newer));

    const store = new CartStore();
    await store.hydrate();
    expect(store.getSnapshot()).toEqual(newer.lines);
  });

  it('falls back to localStorage when CloudStorage is empty', async () => {
    window.localStorage.clear();
    const local = { lines: [{ ...BASE_LINE, variantId: 3, name: 'local' }], updatedAt: 500 };
    window.localStorage.setItem('dunyo.cart.v1', JSON.stringify(local));
    mockTelegram(null);

    const store = new CartStore();
    await store.hydrate();
    expect(store.getSnapshot()).toEqual(local.lines);
  });
});
