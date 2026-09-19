// Maps the create_order RPC's `{ok:false, ...}` result to an HTTP status and
// response details. Pulled into its own pure module (no DB/HTTP imports) so
// it is trivially unit-testable and so the POST /orders route can't
// accidentally drop the RPC's item/amount details when turning it into a
// response.

export type CreateOrderRpcResult =
  | { ok: true; order_id: number; order_no: string; duplicate: boolean }
  | { ok: false; code: 'delivery_disabled' }
  | { ok: false; code: 'region_invalid' }
  | { ok: false; code: 'stock_changed'; items: Array<{ variant_id: number; available: number }> }
  | { ok: false; code: 'price_changed'; items: Array<{ variant_id: number; price: number }> }
  | { ok: false; code: 'min_order'; min_order_amount: number; items_total: number };

export type CreateOrderRpcFailure = Exclude<CreateOrderRpcResult, { ok: true }>;

export interface MappedOrderFailure {
  status: number;
  code: string;
  details?: Record<string, unknown>;
}

// Per spec EARS: stock/price conflicts are 409 (the client can resolve them
// by refreshing the cart and resubmitting); delivery/region/min-order rules
// are 422.
const CONFLICT_CODES: ReadonlySet<string> = new Set(['stock_changed', 'price_changed']);

export function mapCreateOrderFailure(failure: CreateOrderRpcFailure): MappedOrderFailure {
  const status = CONFLICT_CODES.has(failure.code) ? 409 : 422;

  const details: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(failure)) {
    if (key !== 'code' && key !== 'ok') {
      details[key] = value;
    }
  }

  return {
    status,
    code: failure.code,
    details: Object.keys(details).length > 0 ? details : undefined,
  };
}
