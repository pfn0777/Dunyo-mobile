// GET /api/public/settings must never leak shop_group_chat_id or
// required_channel (or any other private settings column) to an
// unauthenticated caller. The SQL in routes/public.ts already selects only
// the public columns explicitly (never `select *`), but this projector is a
// second, independently-testable line of defense: it reads the row by named
// field and builds a brand-new object, so even a row that (by some future
// mistake) carries extra private columns can never leak them through here.

export interface PublicSettingsRow {
  min_order_amount: string | number;
  free_delivery_threshold: string | number;
  delivery_enabled: boolean;
  pickup_address: string | null;
  installment_months: number;
  support_username: string | null;
  // Deliberately typed as optional/unknown here (not required): a row that
  // accidentally still carries these must not be able to satisfy this
  // interface by omission alone — the test asserts the output never has them.
  shop_group_chat_id?: unknown;
  required_channel?: unknown;
}

export interface PublicSettingsBody {
  min_order_amount: number;
  free_delivery_threshold: number;
  delivery_enabled: boolean;
  pickup_address: string | null;
  installment_months: number;
  support_username: string | null;
}

export function projectPublicSettings(row: PublicSettingsRow): PublicSettingsBody {
  return {
    min_order_amount: Number(row.min_order_amount),
    free_delivery_threshold: Number(row.free_delivery_threshold),
    delivery_enabled: row.delivery_enabled,
    pickup_address: row.pickup_address,
    installment_months: row.installment_months,
    support_username: row.support_username,
  };
}
