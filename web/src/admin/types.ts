// Admin-only types. Kept out of src/lib/types.ts so the customer bundle never
// needs to know about admin-side shapes. Unlike XUMO, price/stock never live
// on the product row here — Dunyo Mobile phones come in color/storage SKUs
// (product_variants), so AdminProduct and AdminVariant are two distinct types
// (see db/migrations/0001_init.sql).

import type { AdminRole, DeliveryType, OrderStatus, PaymentMethod } from '../lib/types.ts';

export type { AdminRole };

// ---------------------------------------------------------------------------
// Products / variants
// ---------------------------------------------------------------------------

export interface AdminProduct {
  id: number;
  name: string;
  brand_id: number;
  category_id: number;
  description: string | null;
  warranty_months: number;
  specs: Record<string, unknown>;
  is_active: boolean;
  sold_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminVariant {
  id: number;
  product_id: number;
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductFormInput {
  name: string;
  brandId: number;
  categoryId: number;
  warrantyMonths: number;
  description: string | null;
  /** Flat key/value specs object — the editor never nests. */
  specs: Record<string, string>;
  isActive: boolean;
}

export interface VariantFormInput {
  sku: string | null;
  colorName: string;
  colorHex: string | null;
  storageGb: number | null;
  price: number;
  oldPrice: number | null;
  stock: number;
  sortOrder: number;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Categories / brands / regions / banners
// ---------------------------------------------------------------------------

export interface AdminCategory {
  id: number;
  name: string;
  icon: string | null;
  image_path: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface CategoryFormInput {
  name: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminBrand {
  id: number;
  name: string;
  logo_path: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface BrandFormInput {
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminRegion {
  id: number;
  name: string;
  delivery_fee: number;
  eta_text: string | null;
  /** null means "inherit settings.free_delivery_threshold" — see 0001_init.sql. */
  free_delivery_threshold: number | null;
  sort_order: number;
  is_active: boolean;
}

export interface RegionFormInput {
  name: string;
  deliveryFee: number;
  etaText: string | null;
  freeDeliveryThreshold: number | null;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminBanner {
  id: number;
  image_path: string | null;
  title: string | null;
  subtitle: string | null;
  link_type: string | null;
  link_id: number | null;
  sort_order: number;
  is_active: boolean;
}

export interface BannerFormInput {
  title: string | null;
  subtitle: string | null;
  linkType: string | null;
  linkId: number | null;
  sortOrder: number;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface AdminOrderSummary {
  id: number;
  order_no: string;
  user_id: number;
  status: OrderStatus;
  delivery_type: DeliveryType;
  region_id: number | null;
  region_name: string | null;
  customer_name: string;
  customer_phone: string;
  payment_method: PaymentMethod;
  tracking_note: string | null;
  items_total: number;
  discount_total: number;
  delivery_fee: number;
  grand_total: number;
  installment_months: number | null;
  created_at: string;
}

export interface AdminOrderItem {
  variant_id: number | null;
  product_id: number | null;
  name_snapshot: string;
  color_snapshot: string | null;
  storage_snapshot: number | null;
  price_snapshot: number;
  old_price_snapshot: number | null;
  warranty_snapshot: number | null;
  qty: number;
}

export interface AdminOrderStatusHistoryEntry {
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: number | null;
  created_at: string;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  address_text: string | null;
  lat: number | null;
  lng: number | null;
  comment: string | null;
  items: AdminOrderItem[];
  history: AdminOrderStatusHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Settings / admins / audit
// ---------------------------------------------------------------------------

export interface SettingsData {
  min_order_amount: number;
  free_delivery_threshold: number;
  delivery_enabled: boolean;
  shop_group_chat_id: number | null;
  pickup_address: string | null;
  /** Channel every customer must join; null switches the gate off. */
  required_channel: string | null;
  installment_months: number;
  support_username: string | null;
}

export interface SettingsFormInput {
  freeDeliveryThreshold?: number;
  minOrderAmount?: number;
  deliveryEnabled?: boolean;
  shopGroupChatId?: number | null;
  pickupAddress?: string | null;
  requiredChannel?: string | null;
  installmentMonths?: number;
  supportUsername?: string | null;
}

export interface AdminUserRow {
  telegram_id: number;
  role: AdminRole;
  added_by: number | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  admin_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export interface ImportRowError {
  rowNumber: number;
  errors: string[];
}

export interface ImportResult {
  created: number;
  updated: number;
  errors: ImportRowError[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
}

/** Contract implemented by both the real admin client (adminApi.ts) and the
 * in-memory mock (lib/mock.ts, active when VITE_MOCK=1). */
export interface AdminApiClient {
  getProducts(params: { q?: string; brandId?: number; categoryId?: number; page: number }): Promise<Paged<AdminProduct>>;
  getProduct(id: number): Promise<AdminProduct>;
  createProduct(input: ProductFormInput): Promise<AdminProduct>;
  updateProduct(id: number, input: ProductFormInput): Promise<AdminProduct>;
  deleteProduct(id: number): Promise<void>;
  importProducts(fileName: string, rows: Record<string, unknown>[]): Promise<ImportResult>;

  getVariants(productId: number): Promise<AdminVariant[]>;
  createVariant(productId: number, input: VariantFormInput): Promise<AdminVariant>;
  updateVariant(id: number, input: VariantFormInput): Promise<AdminVariant>;
  deleteVariant(id: number): Promise<void>;
  uploadVariantImage(id: number, thumb: Blob, main: Blob): Promise<AdminVariant>;

  getCategories(): Promise<AdminCategory[]>;
  createCategory(input: CategoryFormInput): Promise<AdminCategory>;
  updateCategory(id: number, input: Partial<CategoryFormInput>): Promise<AdminCategory>;
  deleteCategory(id: number): Promise<void>;

  getBrands(): Promise<AdminBrand[]>;
  createBrand(input: BrandFormInput): Promise<AdminBrand>;
  updateBrand(id: number, input: BrandFormInput): Promise<AdminBrand>;
  deleteBrand(id: number): Promise<void>;

  getRegions(): Promise<AdminRegion[]>;
  createRegion(input: RegionFormInput): Promise<AdminRegion>;
  updateRegion(id: number, input: RegionFormInput): Promise<AdminRegion>;
  deleteRegion(id: number): Promise<void>;

  getBanners(): Promise<AdminBanner[]>;
  createBanner(input: BannerFormInput): Promise<AdminBanner>;
  updateBanner(id: number, input: Partial<BannerFormInput>): Promise<AdminBanner>;
  deleteBanner(id: number): Promise<void>;
  uploadBannerImage(id: number, image: Blob): Promise<AdminBanner>;

  getOrders(params: { status?: OrderStatus; regionId?: number; page: number }): Promise<Paged<AdminOrderSummary>>;
  getOrder(id: number): Promise<AdminOrderDetail>;
  setOrderStatus(id: number, status: OrderStatus, trackingNote: string | null): Promise<{ order_id: number; status: OrderStatus }>;

  getSettings(): Promise<SettingsData>;
  updateSettings(input: SettingsFormInput): Promise<SettingsData>;

  getAdmins(): Promise<AdminUserRow[]>;
  addAdmin(telegramId: number): Promise<AdminUserRow>;
  deleteAdmin(telegramId: number): Promise<void>;

  getAudit(page: number): Promise<Paged<AuditLogEntry>>;
}
