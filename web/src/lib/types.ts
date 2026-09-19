// Mirrors api/src/routes/public.ts and api/src/routes/customer.ts JSON
// exactly. Money fields arrive as numbers (the API converts bigint columns
// server-side via toNumber/toNullableNumber).

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  image_path: string | null;
}

export interface Brand {
  id: number;
  name: string;
  logo_path: string | null;
}

export interface Region {
  id: number;
  name: string;
  delivery_fee: number;
  eta_text: string | null;
  free_delivery_threshold: number | null;
}

export interface Banner {
  id: number;
  image_path: string | null;
  title: string | null;
  subtitle: string | null;
  link_type: string | null;
  link_id: number | null;
}

/** Product card as returned by GET /public/products, /products/by-ids and
 * GET /favorites — price/stock are aggregated over the product's active
 * variants (min_price / total_stock / variant_count). */
export interface Product {
  id: number;
  name: string;
  brand_id: number;
  brand_name: string;
  category_id: number;
  /** Material Symbols icon name, used as the no-image placeholder. */
  category_icon: string | null;
  warranty_months: number;
  min_price: number;
  old_price: number | null;
  thumb: string | null;
  total_stock: number;
  variant_count: number;
  sold_count: number;
}

export interface ProductVariant {
  id: number;
  sku: string | null;
  color_name: string;
  color_hex: string | null;
  storage_gb: number | null;
  price: number;
  old_price: number | null;
  stock: number;
  image_thumb_path: string | null;
  image_path: string | null;
  sort_order: number;
}

/** GET /public/products/:id — the product plus every active variant (SKU). */
export interface ProductDetail {
  id: number;
  name: string;
  brand_id: number;
  brand_name: string;
  category_id: number;
  /** Material Symbols icon name, used as the no-image placeholder. */
  category_icon: string | null;
  warranty_months: number;
  description: string | null;
  specs: Record<string, unknown> | null;
  variants: ProductVariant[];
}

export interface PublicSettings {
  min_order_amount: number;
  free_delivery_threshold: number;
  delivery_enabled: boolean;
  pickup_address: string | null;
  installment_months: number;
  support_username: string | null;
}

export type AdminRole = 'owner' | 'admin';

export interface Me {
  id: number;
  first_name: string;
  last_name: string | null;
  username: string | null;
  phone: string | null;
  phone_verified: boolean;
  is_admin: boolean;
  admin_role: AdminRole | null;
  /** True while the user must still join the required channel (admins are exempt). */
  channel_required: boolean;
  /** Channel to link to; null when the gate is off. */
  channel_username: string | null;
}

export interface Address {
  id: number;
  region_id: number | null;
  label: string | null;
  text: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
}

// Six values (adds `shipped`, meaningful only for delivery_type='delivery' —
// see shared/src/orderStatus.ts canTransition/isTerminal).
export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'on_the_way' | 'delivered' | 'cancelled';
export type DeliveryType = 'delivery' | 'pickup';
export type PaymentMethod = 'cash' | 'card_to_courier' | 'installment_request';

export interface OrderSummary {
  id: number;
  order_no: string;
  status: OrderStatus;
  delivery_type: DeliveryType;
  payment_method: PaymentMethod;
  tracking_note: string | null;
  items_total: number;
  delivery_fee: number;
  grand_total: number;
  created_at: string;
}

export interface OrderItem {
  variant_id: number;
  product_id: number;
  name_snapshot: string;
  color_snapshot: string;
  storage_snapshot: number | null;
  price_snapshot: number;
  old_price_snapshot: number | null;
  warranty_snapshot: number;
  qty: number;
}

export interface OrderStatusHistoryEntry {
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string | null;
  created_at: string;
}

export interface OrderDetail extends OrderSummary {
  region_id: number | null;
  region_name: string | null;
  address_text: string | null;
  lat: number | null;
  lng: number | null;
  customer_name: string;
  customer_phone: string;
  comment: string | null;
  discount_total: number;
  installment_months: number | null;
  items: OrderItem[];
  history: OrderStatusHistoryEntry[];
}

export type SortOption = 'popular' | 'cheap' | 'expensive' | 'discount';

export interface ProductsQuery {
  categoryId?: number;
  brandId?: number;
  q?: string;
  sort?: SortOption;
  discount?: boolean;
  page: number;
}

export interface ProductsPage {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}
