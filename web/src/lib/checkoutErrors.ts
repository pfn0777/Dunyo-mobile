// Pure mapping from a checkout API error to the UI action to take. Kept
// dependency-free (no cart/api imports) so it's directly unit-testable.
//
// Server payloads key stock/price conflicts by variant_id (see
// api/src/lib/orderErrors.ts) since price/stock live on product_variants,
// not products.

export interface StockChangedItem {
  variant_id: number;
  available: number;
}
export interface PriceChangedItem {
  variant_id: number;
  price: number;
}

export type CheckoutErrorAction =
  | { kind: 'stock_changed'; items: StockChangedItem[] }
  | { kind: 'price_changed'; items: PriceChangedItem[] }
  | { kind: 'delivery_disabled' }
  | { kind: 'region_invalid' }
  | { kind: 'min_order'; minOrderAmount: number; itemsTotal: number }
  | { kind: 'generic' };

export interface CheckoutErrorLike {
  status: number;
  code: string;
  details?: Record<string, unknown>;
}

function isStockItems(value: unknown): value is StockChangedItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as StockChangedItem).variant_id === 'number' &&
        typeof (v as StockChangedItem).available === 'number',
    )
  );
}

function isPriceItems(value: unknown): value is PriceChangedItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as PriceChangedItem).variant_id === 'number' &&
        typeof (v as PriceChangedItem).price === 'number',
    )
  );
}

export function mapCheckoutError(error: CheckoutErrorLike): CheckoutErrorAction {
  if (error.code === 'stock_changed' && isStockItems(error.details?.['items'])) {
    return { kind: 'stock_changed', items: error.details!['items'] as StockChangedItem[] };
  }
  if (error.code === 'price_changed' && isPriceItems(error.details?.['items'])) {
    return { kind: 'price_changed', items: error.details!['items'] as PriceChangedItem[] };
  }
  if (error.code === 'delivery_disabled') {
    return { kind: 'delivery_disabled' };
  }
  if (error.code === 'region_invalid') {
    return { kind: 'region_invalid' };
  }
  if (error.code === 'min_order') {
    const minOrderAmount = typeof error.details?.['min_order_amount'] === 'number' ? (error.details['min_order_amount'] as number) : 0;
    const itemsTotal = typeof error.details?.['items_total'] === 'number' ? (error.details['items_total'] as number) : 0;
    return { kind: 'min_order', minOrderAmount, itemsTotal };
  }
  return { kind: 'generic' };
}
