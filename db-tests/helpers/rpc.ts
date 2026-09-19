import type { PGlite } from '@electric-sql/pglite';

export interface CreateOrderItemInput {
  variant_id: number;
  qty: number;
  // Required: the client must echo back the price it showed the customer so
  // the server can detect (and refuse to silently accept) a price change.
  expected_price: number;
}

export interface CreateOrderPayload {
  idempotency_key: string;
  delivery_type: 'delivery' | 'pickup';
  region_id?: number;
  address_text?: string;
  lat?: number;
  lng?: number;
  customer_name: string;
  customer_phone: string;
  comment?: string;
  payment_method: 'cash' | 'card_to_courier' | 'installment_request';
  items: CreateOrderItemInput[];
}

export type CreateOrderResult =
  | {
      ok: true;
      order_id: number;
      order_no: string;
      duplicate: boolean;
      items_total?: number;
      discount_total?: number;
      delivery_fee?: number;
      grand_total?: number;
    }
  | { ok: false; code: 'delivery_disabled' }
  | { ok: false; code: 'region_invalid' }
  | { ok: false; code: 'stock_changed'; items: Array<{ variant_id: number; available: number }> }
  | { ok: false; code: 'price_changed'; items: Array<{ variant_id: number; price: number }> }
  | { ok: false; code: 'min_order'; min_order_amount: number; items_total: number };

export type SetOrderStatusResult =
  | {
      ok: true;
      order_id: number;
      from: string;
      to: string;
      user_id: number;
      order_no: string;
    }
  | { ok: false; code: 'invalid_transition'; from: string; to: string };

export async function callCreateOrder(
  db: PGlite,
  userId: number,
  payload: CreateOrderPayload | Record<string, unknown>,
): Promise<CreateOrderResult> {
  const res = await db.query<{ result: CreateOrderResult }>(
    'select public.create_order($1, $2::jsonb) as result',
    [userId, JSON.stringify(payload)],
  );
  return res.rows[0]!.result;
}

export async function callSetOrderStatus(
  db: PGlite,
  orderId: number,
  to: string,
  adminId: number,
  trackingNote: string | null = null,
): Promise<SetOrderStatusResult> {
  const res = await db.query<{ result: SetOrderStatusResult }>(
    'select public.set_order_status($1, $2::public.order_status, $3, $4) as result',
    [orderId, to, adminId, trackingNote],
  );
  return res.rows[0]!.result;
}
