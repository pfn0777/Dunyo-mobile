// Cart store built on useSyncExternalStore (no extra state library).
// Persisted to localStorage and mirrored to Telegram CloudStorage; on start
// the newer of the two (by updatedAt) wins.
//
// A line's identity is `variantId` (not `productId`): two variants of the
// same product (e.g. two colours of the same iPhone) are two distinct lines.

import { calcTotals, type PricingSettings, type PricingTotals } from '../../../shared/src/pricing.ts';
import { cloudStorageGet, cloudStorageSet } from './telegram.ts';

export interface CartLine {
  variantId: number;
  productId: number;
  qty: number;
  price: number;
  oldPrice: number | null;
  name: string;
  colorName: string;
  storageGb: number | null;
  thumb: string | null;
  stock: number;
}

interface CartState {
  lines: CartLine[];
  updatedAt: number;
}

const STORAGE_KEY = 'dunyo.cart.v1';
const CLOUD_STORAGE_KEY = 'dunyo_cart_v1';
const CLOUD_SYNC_DEBOUNCE_MS = 800;

function emptyState(): CartState {
  return { lines: [], updatedAt: 0 };
}

function readLocalStorage(): CartState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    return JSON.parse(raw) as CartState;
  } catch (error) {
    console.error('cart: failed to read localStorage', error);
    return null;
  }
}

function writeLocalStorage(state: CartState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('cart: failed to write localStorage', error);
  }
}

let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleCloudSync(state: CartState): void {
  if (cloudSyncTimer !== null) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    void cloudStorageSet(CLOUD_STORAGE_KEY, JSON.stringify(state));
  }, CLOUD_SYNC_DEBOUNCE_MS);
}

export class CartStore {
  private state: CartState = emptyState();
  private listeners = new Set<() => void>();
  private hydrated = false;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): CartLine[] => this.state.lines;

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private commit(lines: CartLine[]): void {
    this.state = { lines, updatedAt: Date.now() };
    writeLocalStorage(this.state);
    scheduleCloudSync(this.state);
    this.emit();
  }

  /** Loads the newer of localStorage/CloudStorage. Call once on app start. */
  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;

    const local = readLocalStorage();
    let cloud: CartState | null = null;
    try {
      const raw = await cloudStorageGet(CLOUD_STORAGE_KEY);
      cloud = raw !== null ? (JSON.parse(raw) as CartState) : null;
    } catch (error) {
      console.error('cart: failed to parse CloudStorage value', error);
    }

    const winner =
      local !== null && cloud !== null
        ? local.updatedAt >= cloud.updatedAt
          ? local
          : cloud
        : (local ?? cloud ?? emptyState());

    this.state = winner;
    this.emit();
  }

  addOrIncrement(line: Omit<CartLine, 'qty'>, qty = 1): void {
    const existing = this.state.lines.find((l) => l.variantId === line.variantId);
    if (existing !== undefined) {
      const nextQty = Math.min(existing.qty + qty, line.stock);
      this.setQty(line.variantId, nextQty);
      return;
    }
    if (line.stock <= 0) return;
    const initialQty = Math.min(qty, line.stock);
    this.commit([...this.state.lines, { ...line, qty: initialQty }]);
  }

  setQty(variantId: number, qty: number): void {
    if (qty <= 0) {
      this.remove(variantId);
      return;
    }
    this.commit(
      this.state.lines.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(qty, l.stock) } : l)),
    );
  }

  remove(variantId: number): void {
    this.commit(this.state.lines.filter((l) => l.variantId !== variantId));
  }

  clear(): void {
    this.commit([]);
  }

  /** Applies fresh price/stock from the server (called before checkout).
   * Returns which variant ids changed price or had qty clamped by stock. */
  reconcile(fresh: Array<{ id: number; price: number; oldPrice: number | null; stock: number }>): {
    priceChanged: number[];
    stockChanged: number[];
  } {
    const priceChanged: number[] = [];
    const stockChanged: number[] = [];
    const freshById = new Map(fresh.map((v) => [v.id, v]));

    const nextLines = this.state.lines
      .map((line) => {
        const server = freshById.get(line.variantId);
        if (server === undefined) {
          stockChanged.push(line.variantId);
          return { ...line, qty: 0 };
        }
        let next = line;
        if (server.price !== line.price || server.oldPrice !== line.oldPrice) {
          priceChanged.push(line.variantId);
          next = { ...next, price: server.price, oldPrice: server.oldPrice };
        }
        if (server.stock < line.qty) {
          stockChanged.push(line.variantId);
          next = { ...next, qty: server.stock, stock: server.stock };
        } else {
          next = { ...next, stock: server.stock };
        }
        return next;
      })
      .filter((line) => line.qty > 0);

    this.commit(nextLines);
    return { priceChanged, stockChanged };
  }

  totals(settings: PricingSettings, deliveryType: 'delivery' | 'pickup'): PricingTotals {
    return calcTotals(
      this.state.lines.map((l) => ({ price: l.price, oldPrice: l.oldPrice, qty: l.qty })),
      settings,
      deliveryType,
    );
  }
}

export const cartStore = new CartStore();
