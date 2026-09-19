// Pure request-body validators. Every write endpoint runs its input through
// one of these before touching the database — the server never trusts a
// client-computed total, id ownership, or "already validated on the client"
// claim.
//
// These `code` strings are a public API contract the Mini App branches on —
// treat renaming one as a breaking change.

import { normalizePhone } from '@dunyo/shared';
import type { DeliveryType, OrderStatus } from '@dunyo/shared';
import { normalizeChannelHandle } from './channelGate.js';

export const MAX_ADDRESSES_PER_USER = 10;
export const WEBP_MAX_BYTES = 1 * 1024 * 1024; // 1 MB
export const WEBP_CONTENT_TYPE = 'image/webp';

export type PaymentMethod = 'cash' | 'card_to_courier' | 'installment_request';

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const POSITIVE_INTEGER_ID_RE = /^[1-9]\d*$/;

/**
 * Parses a path/query id segment (e.g. from a route param) as a strict
 * positive integer: no sign, no leading zero, no decimal point. Returns null
 * for anything else, so route handlers can respond 400/404 instead of
 * passing a malformed value into a Postgres query or RPC argument.
 */
export function parsePositiveIntegerId(raw: string): number | null {
  if (!POSITIVE_INTEGER_ID_RE.test(raw)) {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value) ? value : null;
}

// All six order_status enum values (public.order_status in the DB). Kept
// here rather than re-derived from @dunyo/shared so a status value can be
// checked before it ever reaches the set_order_status RPC — an invalid
// string cast to the Postgres enum raises 22P02, which must never surface
// as a 500.
export const ORDER_STATUS_VALUES: readonly OrderStatus[] = [
  'new',
  'confirmed',
  'shipped',
  'on_the_way',
  'delivered',
  'cancelled',
];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUS_VALUES as readonly string[]).includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

// ---------------------------------------------------------------------------
// WebP magic-byte check
// ---------------------------------------------------------------------------

// "RIFF" then 4 bytes of size, then "WEBP".
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
const WEBP_HEADER_MIN_BYTES = 12;

/** Checks that a byte buffer actually starts with a RIFF....WEBP header
 * (not just an `image/webp` content-type claim from the client). */
export function isWebpMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < WEBP_HEADER_MIN_BYTES) {
    return false;
  }
  for (let i = 0; i < RIFF_MAGIC.length; i += 1) {
    if (bytes[i] !== RIFF_MAGIC[i]) {
      return false;
    }
  }
  for (let i = 0; i < WEBP_MAGIC.length; i += 1) {
    if (bytes[8 + i] !== WEBP_MAGIC[i]) {
      return false;
    }
  }
  return true;
}

export interface WebpUploadValidationOk {
  ok: true;
}
export type WebpUploadValidationResult =
  | WebpUploadValidationOk
  | { ok: false; code: 'invalid_content_type' | 'too_large' | 'invalid_magic_bytes' };

export function validateWebpUpload(
  contentType: string,
  size: number,
  bytes: Uint8Array,
): WebpUploadValidationResult {
  if (contentType !== WEBP_CONTENT_TYPE) {
    return { ok: false, code: 'invalid_content_type' };
  }
  if (size >= WEBP_MAX_BYTES) {
    return { ok: false, code: 'too_large' };
  }
  if (!isWebpMagicBytes(bytes)) {
    return { ok: false, code: 'invalid_magic_bytes' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface OrderItemInput {
  variant_id: number;
  qty: number;
  expected_price: number;
}

export interface OrderCreateInput {
  idempotencyKey: string;
  deliveryType: DeliveryType;
  regionId: number | null;
  addressText: string | null;
  lat: number | null;
  lng: number | null;
  customerName: string;
  customerPhone: string;
  comment: string | null;
  paymentMethod: PaymentMethod;
  items: OrderItemInput[];
}

export type OrderCreateValidationResult =
  | { ok: true; value: OrderCreateInput }
  | { ok: false; code: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateOrderItems(raw: unknown): OrderItemInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const items: OrderItemInput[] = [];
  for (const entry of raw) {
    if (!isPlainObject(entry)) {
      return null;
    }
    const variantId = entry['variant_id'];
    const qty = entry['qty'];
    const expectedPrice = entry['expected_price'];
    if (!isPositiveInteger(variantId) || !isPositiveInteger(qty) || !isNonNegativeInteger(expectedPrice)) {
      return null;
    }
    items.push({ variant_id: variantId, qty, expected_price: expectedPrice });
  }
  return items;
}

/** Validates the POST /orders body. Rejects malformed shapes before the
 * request ever reaches the create_order RPC. customer_phone is normalized
 * with the shared normalizePhone (server-side, never trusts client format). */
export function validateOrderCreateBody(raw: unknown): OrderCreateValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, code: 'bad_request' };
  }

  const idempotencyKey = raw['idempotency_key'];
  if (typeof idempotencyKey !== 'string' || !UUID_RE.test(idempotencyKey)) {
    return { ok: false, code: 'bad_request' };
  }

  const deliveryType = raw['delivery_type'];
  if (deliveryType !== 'delivery' && deliveryType !== 'pickup') {
    return { ok: false, code: 'bad_request' };
  }

  const paymentMethod = raw['payment_method'];
  if (paymentMethod !== 'cash' && paymentMethod !== 'card_to_courier' && paymentMethod !== 'installment_request') {
    return { ok: false, code: 'bad_request' };
  }

  const customerName = raw['customer_name'];
  if (!isNonEmptyString(customerName)) {
    return { ok: false, code: 'bad_request' };
  }

  const rawPhone = raw['customer_phone'];
  const customerPhone = typeof rawPhone === 'string' ? normalizePhone(rawPhone) : null;
  if (customerPhone === null) {
    return { ok: false, code: 'invalid_phone' };
  }

  const addressText = typeof raw['address_text'] === 'string' ? (raw['address_text'] as string).trim() : '';
  if (deliveryType === 'delivery' && addressText.length === 0) {
    return { ok: false, code: 'bad_request' };
  }

  let regionId: number | null = null;
  if ('region_id' in raw && raw['region_id'] !== undefined && raw['region_id'] !== null) {
    if (!isPositiveInteger(raw['region_id'])) {
      return { ok: false, code: 'bad_request' };
    }
    regionId = raw['region_id'] as number;
  }

  const rawLat = raw['lat'];
  const rawLng = raw['lng'];
  const lat = typeof rawLat === 'number' ? rawLat : null;
  const lng = typeof rawLng === 'number' ? rawLng : null;
  if ((lat !== null && (lat < -90 || lat > 90)) || (lng !== null && (lng < -180 || lng > 180))) {
    return { ok: false, code: 'bad_request' };
  }

  const comment = typeof raw['comment'] === 'string' && raw['comment'].trim().length > 0 ? raw['comment'].trim() : null;

  const items = validateOrderItems(raw['items']);
  if (items === null) {
    return { ok: false, code: 'bad_request' };
  }

  return {
    ok: true,
    value: {
      idempotencyKey,
      deliveryType,
      regionId,
      addressText: addressText.length > 0 ? addressText : null,
      lat,
      lng,
      customerName: customerName.trim(),
      customerPhone,
      comment,
      paymentMethod,
      items,
    },
  };
}

// ---------------------------------------------------------------------------
// Order status (admin PATCH/POST /admin/orders/:id/status)
// ---------------------------------------------------------------------------

export interface OrderStatusWriteInput {
  status: OrderStatus;
  trackingNote: string | null;
}

export type OrderStatusWriteValidationResult =
  | { ok: true; value: OrderStatusWriteInput }
  | { ok: false; code: string };

const TRACKING_NOTE_MAX_LENGTH = 500;

export function validateOrderStatusBody(raw: unknown): OrderStatusWriteValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, code: 'bad_request' };
  }
  const status = raw['status'];
  if (!isOrderStatus(status)) {
    return { ok: false, code: 'invalid_status' };
  }

  let trackingNote: string | null = null;
  if ('tracking_note' in raw && raw['tracking_note'] !== undefined && raw['tracking_note'] !== null) {
    const rawNote = raw['tracking_note'];
    if (typeof rawNote !== 'string') {
      return { ok: false, code: 'invalid_tracking_note' };
    }
    const trimmed = rawNote.trim();
    if (trimmed.length > TRACKING_NOTE_MAX_LENGTH) {
      return { ok: false, code: 'invalid_tracking_note' };
    }
    trackingNote = trimmed.length > 0 ? trimmed : null;
  }

  return { ok: true, value: { status, trackingNote } };
}

// ---------------------------------------------------------------------------
// Products (no price/stock — those live on variants)
// ---------------------------------------------------------------------------

export interface ProductWriteInput {
  name: string;
  brandId: number;
  categoryId: number;
  warrantyMonths: number;
  description: string | null;
  specs: Record<string, unknown>;
  isActive: boolean;
}

export type ProductWriteValidationResult =
  | { ok: true; value: ProductWriteInput }
  | { ok: false; code: string };

const DEFAULT_WARRANTY_MONTHS = 12;

export function validateProductWriteBody(raw: unknown): ProductWriteValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, code: 'bad_request' };
  }

  const name = raw['name'];
  if (!isNonEmptyString(name)) {
    return { ok: false, code: 'invalid_name' };
  }

  const brandId = raw['brand_id'];
  if (!isPositiveInteger(brandId)) {
    return { ok: false, code: 'invalid_brand' };
  }

  const categoryId = raw['category_id'];
  if (!isPositiveInteger(categoryId)) {
    return { ok: false, code: 'invalid_category' };
  }

  let warrantyMonths = DEFAULT_WARRANTY_MONTHS;
  if ('warranty_months' in raw && raw['warranty_months'] !== undefined) {
    if (!isNonNegativeInteger(raw['warranty_months'])) {
      return { ok: false, code: 'invalid_warranty_months' };
    }
    warrantyMonths = raw['warranty_months'] as number;
  }

  const rawDescription = raw['description'];
  if (rawDescription !== undefined && rawDescription !== null && typeof rawDescription !== 'string') {
    return { ok: false, code: 'invalid_description' };
  }
  const description = typeof rawDescription === 'string' && rawDescription.trim().length > 0
    ? rawDescription.trim()
    : null;

  let specs: Record<string, unknown> = {};
  if ('specs' in raw && raw['specs'] !== undefined) {
    if (!isPlainObject(raw['specs'])) {
      return { ok: false, code: 'invalid_specs' };
    }
    specs = raw['specs'];
  }

  const isActive = raw['is_active'] !== false;

  return {
    ok: true,
    value: {
      name: (name as string).trim(),
      brandId,
      categoryId,
      warrantyMonths,
      description,
      specs,
      isActive,
    },
  };
}

// ---------------------------------------------------------------------------
// Product variants (color/storage SKUs — price/stock/images live here)
// ---------------------------------------------------------------------------

export interface VariantWriteInput {
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

export type VariantWriteValidationResult =
  | { ok: true; value: VariantWriteInput }
  | { ok: false; code: string };

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// image_thumb_path / image_path are deliberately never accepted here: they
// are only ever set by the image-upload route (which computes a
// content-hashed media path), mirroring the banner pattern in XUMO.
export function validateVariantWriteBody(raw: unknown): VariantWriteValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, code: 'bad_request' };
  }

  const colorName = raw['color_name'];
  if (!isNonEmptyString(colorName)) {
    return { ok: false, code: 'invalid_color_name' };
  }

  const rawColorHex = raw['color_hex'];
  let colorHex: string | null = null;
  if (rawColorHex !== undefined && rawColorHex !== null) {
    if (typeof rawColorHex !== 'string' || !HEX_COLOR_RE.test(rawColorHex)) {
      return { ok: false, code: 'invalid_color_hex' };
    }
    colorHex = rawColorHex;
  }

  const rawStorageGb = raw['storage_gb'];
  let storageGb: number | null = null;
  if (rawStorageGb !== undefined && rawStorageGb !== null) {
    if (!isPositiveInteger(rawStorageGb)) {
      return { ok: false, code: 'invalid_storage_gb' };
    }
    storageGb = rawStorageGb;
  }

  const price = raw['price'];
  if (!isPositiveInteger(price)) {
    return { ok: false, code: 'invalid_price' };
  }

  const rawOldPrice = raw['old_price'];
  let oldPrice: number | null = null;
  if (rawOldPrice !== undefined && rawOldPrice !== null) {
    if (!isPositiveInteger(rawOldPrice) || rawOldPrice <= price) {
      return { ok: false, code: 'invalid_old_price' };
    }
    oldPrice = rawOldPrice;
  }

  const stock = raw['stock'];
  if (!isNonNegativeInteger(stock)) {
    return { ok: false, code: 'invalid_stock' };
  }

  const rawSku = raw['sku'];
  let sku: string | null = null;
  if (rawSku !== undefined && rawSku !== null) {
    if (typeof rawSku !== 'string' || rawSku.trim().length === 0) {
      return { ok: false, code: 'invalid_sku' };
    }
    sku = rawSku.trim();
  }

  let sortOrder = 0;
  if ('sort_order' in raw && raw['sort_order'] !== undefined) {
    if (typeof raw['sort_order'] !== 'number' || !Number.isInteger(raw['sort_order'])) {
      return { ok: false, code: 'invalid_sort_order' };
    }
    sortOrder = raw['sort_order'];
  }

  let isActive = true;
  if ('is_active' in raw && raw['is_active'] !== undefined) {
    if (typeof raw['is_active'] !== 'boolean') {
      return { ok: false, code: 'invalid_is_active' };
    }
    isActive = raw['is_active'];
  }

  return {
    ok: true,
    value: {
      sku,
      colorName: (colorName as string).trim(),
      colorHex,
      storageGb,
      price,
      oldPrice,
      stock,
      sortOrder,
      isActive,
    },
  };
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export interface BrandWriteInput {
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export type BrandWriteValidationResult =
  | { ok: true; value: BrandWriteInput }
  | { ok: false; code: string };

export function validateBrandWriteBody(raw: unknown): BrandWriteValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, code: 'bad_request' };
  }

  const name = raw['name'];
  if (!isNonEmptyString(name)) {
    return { ok: false, code: 'invalid_name' };
  }

  let sortOrder = 0;
  if ('sort_order' in raw && raw['sort_order'] !== undefined) {
    if (typeof raw['sort_order'] !== 'number' || !Number.isInteger(raw['sort_order'])) {
      return { ok: false, code: 'invalid_sort_order' };
    }
    sortOrder = raw['sort_order'];
  }

  let isActive = true;
  if ('is_active' in raw && raw['is_active'] !== undefined) {
    if (typeof raw['is_active'] !== 'boolean') {
      return { ok: false, code: 'invalid_is_active' };
    }
    isActive = raw['is_active'];
  }

  return { ok: true, value: { name: (name as string).trim(), sortOrder, isActive } };
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

export interface RegionWriteInput {
  name: string;
  deliveryFee: number;
  etaText: string | null;
  freeDeliveryThreshold: number | null;
  sortOrder: number;
  isActive: boolean;
}

export type RegionWriteValidationResult =
  | { ok: true; value: RegionWriteInput }
  | { ok: false; code: string };

export function validateRegionWriteBody(raw: unknown): RegionWriteValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, code: 'bad_request' };
  }

  const name = raw['name'];
  if (!isNonEmptyString(name)) {
    return { ok: false, code: 'invalid_name' };
  }

  const deliveryFee = raw['delivery_fee'];
  if (!isNonNegativeInteger(deliveryFee)) {
    return { ok: false, code: 'invalid_delivery_fee' };
  }

  const rawEtaText = raw['eta_text'];
  if (rawEtaText !== undefined && rawEtaText !== null && typeof rawEtaText !== 'string') {
    return { ok: false, code: 'invalid_eta_text' };
  }
  const etaText = typeof rawEtaText === 'string' && rawEtaText.trim().length > 0 ? rawEtaText.trim() : null;

  let freeDeliveryThreshold: number | null = null;
  if ('free_delivery_threshold' in raw && raw['free_delivery_threshold'] !== undefined) {
    const rawThreshold = raw['free_delivery_threshold'];
    if (rawThreshold !== null && !isNonNegativeInteger(rawThreshold)) {
      return { ok: false, code: 'invalid_free_delivery_threshold' };
    }
    freeDeliveryThreshold = rawThreshold === null ? null : rawThreshold;
  }

  let sortOrder = 0;
  if ('sort_order' in raw && raw['sort_order'] !== undefined) {
    if (typeof raw['sort_order'] !== 'number' || !Number.isInteger(raw['sort_order'])) {
      return { ok: false, code: 'invalid_sort_order' };
    }
    sortOrder = raw['sort_order'];
  }

  let isActive = true;
  if ('is_active' in raw && raw['is_active'] !== undefined) {
    if (typeof raw['is_active'] !== 'boolean') {
      return { ok: false, code: 'invalid_is_active' };
    }
    isActive = raw['is_active'];
  }

  return {
    ok: true,
    value: { name: (name as string).trim(), deliveryFee, etaText, freeDeliveryThreshold, sortOrder, isActive },
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface SettingsWriteInput {
  freeDeliveryThreshold?: number;
  minOrderAmount?: number;
  deliveryEnabled?: boolean;
  shopGroupChatId?: number | null;
  pickupAddress?: string | null;
  requiredChannel?: string | null;
  installmentMonths?: number;
  supportUsername?: string | null;
}

export type SettingsWriteValidationResult =
  | { ok: true; value: SettingsWriteInput }
  | { ok: false; code: string };

export function validateSettingsWriteBody(raw: unknown): SettingsWriteValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, code: 'bad_request' };
  }

  const value: SettingsWriteInput = {};

  if ('free_delivery_threshold' in raw) {
    if (!isNonNegativeInteger(raw['free_delivery_threshold'])) {
      return { ok: false, code: 'invalid_free_delivery_threshold' };
    }
    value.freeDeliveryThreshold = raw['free_delivery_threshold'] as number;
  }

  if ('min_order_amount' in raw) {
    if (!isNonNegativeInteger(raw['min_order_amount'])) {
      return { ok: false, code: 'invalid_min_order_amount' };
    }
    value.minOrderAmount = raw['min_order_amount'] as number;
  }

  if ('delivery_enabled' in raw) {
    if (typeof raw['delivery_enabled'] !== 'boolean') {
      return { ok: false, code: 'invalid_delivery_enabled' };
    }
    value.deliveryEnabled = raw['delivery_enabled'];
  }

  if ('shop_group_chat_id' in raw) {
    const chatId = raw['shop_group_chat_id'];
    if (chatId !== null && !Number.isInteger(chatId)) {
      return { ok: false, code: 'invalid_shop_group_chat_id' };
    }
    value.shopGroupChatId = chatId as number | null;
  }

  if ('pickup_address' in raw) {
    const address = raw['pickup_address'];
    if (address !== null && typeof address !== 'string') {
      return { ok: false, code: 'invalid_pickup_address' };
    }
    value.pickupAddress = address as string | null;
  }

  if ('required_channel' in raw) {
    const channel = raw['required_channel'];
    if (channel === null) {
      value.requiredChannel = null;
    } else if (typeof channel !== 'string') {
      return { ok: false, code: 'invalid_required_channel' };
    } else if (channel.trim().length === 0) {
      // An empty field in the admin panel means "switch the gate off".
      value.requiredChannel = null;
    } else {
      const normalized = normalizeChannelHandle(channel);
      if (normalized === null) {
        return { ok: false, code: 'invalid_required_channel' };
      }
      value.requiredChannel = normalized;
    }
  }

  if ('installment_months' in raw) {
    if (!isPositiveInteger(raw['installment_months'])) {
      return { ok: false, code: 'invalid_installment_months' };
    }
    value.installmentMonths = raw['installment_months'] as number;
  }

  if ('support_username' in raw) {
    const username = raw['support_username'];
    if (username === null) {
      value.supportUsername = null;
    } else if (typeof username !== 'string' || username.trim().length === 0) {
      return { ok: false, code: 'invalid_support_username' };
    } else {
      value.supportUsername = username.trim();
    }
  }

  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

export interface AddressWriteInput {
  label: string | null;
  text: string;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
}

export type AddressWriteValidationResult =
  | { ok: true; value: AddressWriteInput }
  | { ok: false; code: string };

export function validateAddressWriteBody(raw: unknown): AddressWriteValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, code: 'bad_request' };
  }
  const text = raw['text'];
  if (!isNonEmptyString(text)) {
    return { ok: false, code: 'invalid_text' };
  }
  const rawLabel = raw['label'];
  const label = typeof rawLabel === 'string' && rawLabel.trim().length > 0 ? rawLabel.trim() : null;
  const rawLat = raw['lat'];
  const rawLng = raw['lng'];
  const lat = typeof rawLat === 'number' ? rawLat : null;
  const lng = typeof rawLng === 'number' ? rawLng : null;
  if ((lat !== null && (lat < -90 || lat > 90)) || (lng !== null && (lng < -180 || lng > 180))) {
    return { ok: false, code: 'bad_request' };
  }
  const isDefault = raw['is_default'] === true;
  return { ok: true, value: { label, text: (text as string).trim(), lat, lng, isDefault } };
}

// ---------------------------------------------------------------------------
// Profile (PATCH /me)
// ---------------------------------------------------------------------------

export interface ProfileWriteInput {
  firstName?: string;
  lastName?: string | null;
  phone?: string;
}

export type ProfileWriteValidationResult =
  | { ok: true; value: ProfileWriteInput }
  | { ok: false; code: string };

export function validateProfileWriteBody(raw: unknown): ProfileWriteValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, code: 'bad_request' };
  }
  const value: ProfileWriteInput = {};

  if ('first_name' in raw) {
    if (!isNonEmptyString(raw['first_name'])) {
      return { ok: false, code: 'invalid_first_name' };
    }
    value.firstName = (raw['first_name'] as string).trim();
  }
  if ('last_name' in raw) {
    const lastName = raw['last_name'];
    if (lastName !== null && typeof lastName !== 'string') {
      return { ok: false, code: 'invalid_last_name' };
    }
    value.lastName = lastName === null ? null : lastName.trim();
  }
  if ('phone' in raw) {
    const phoneRaw = raw['phone'];
    const phone = typeof phoneRaw === 'string' ? normalizePhone(phoneRaw) : null;
    if (phone === null) {
      return { ok: false, code: 'invalid_phone' };
    }
    value.phone = phone;
  }
  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------

export interface AdminWriteInput {
  telegramId: number;
  role: 'admin';
}

export type AdminWriteValidationResult =
  | { ok: true; value: AdminWriteInput }
  | { ok: false; code: string };

export function validateAdminWriteBody(raw: unknown): AdminWriteValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, code: 'bad_request' };
  }
  const telegramId = raw['telegram_id'];
  if (!isPositiveInteger(telegramId)) {
    return { ok: false, code: 'invalid_telegram_id' };
  }
  const role = raw['role'];
  if (role !== 'admin') {
    return { ok: false, code: 'invalid_role' };
  }
  return { ok: true, value: { telegramId, role: 'admin' } };
}

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------

// image_path is deliberately never accepted from the client here: it is only
// ever set by the image-upload route (which computes a content-hashed media
// path), so a banner is created/patched without one and starts out with no
// image until the upload succeeds.
export interface BannerWriteInput {
  title: string | null;
  subtitle: string | null;
  linkType: string | null;
  linkId: number | null;
  sortOrder: number;
  isActive: boolean;
}

export type BannerWriteValidationResult =
  | { ok: true; value: BannerWriteInput }
  | { ok: false; code: string };

export function validateBannerWriteBody(raw: unknown): BannerWriteValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, code: 'bad_request' };
  }
  return {
    ok: true,
    value: {
      title: typeof raw['title'] === 'string' ? raw['title'] : null,
      subtitle: typeof raw['subtitle'] === 'string' ? raw['subtitle'] : null,
      linkType: typeof raw['link_type'] === 'string' ? raw['link_type'] : null,
      linkId: typeof raw['link_id'] === 'number' ? raw['link_id'] : null,
      sortOrder: typeof raw['sort_order'] === 'number' ? raw['sort_order'] : 0,
      isActive: raw['is_active'] !== false,
    },
  };
}

export interface BannerPatchInput {
  title?: string | null;
  subtitle?: string | null;
  linkType?: string | null;
  linkId?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}

export type BannerPatchValidationResult =
  | { ok: true; value: BannerPatchInput }
  | { ok: false; code: string };

/** Partial update for PATCH /admin/banners/:id. Unlike the create path,
 * fields are only included when present in the body — and `image_path` is
 * still never one of them, even if the client sends it. */
export function validateBannerPatchBody(raw: unknown): BannerPatchValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, code: 'bad_request' };
  }
  const value: BannerPatchInput = {};
  if ('title' in raw) {
    const title = raw['title'];
    if (title !== null && typeof title !== 'string') return { ok: false, code: 'invalid_title' };
    value.title = title;
  }
  if ('subtitle' in raw) {
    const subtitle = raw['subtitle'];
    if (subtitle !== null && typeof subtitle !== 'string') return { ok: false, code: 'invalid_subtitle' };
    value.subtitle = subtitle;
  }
  if ('link_type' in raw) {
    const linkType = raw['link_type'];
    if (linkType !== null && typeof linkType !== 'string') return { ok: false, code: 'invalid_link_type' };
    value.linkType = linkType;
  }
  if ('link_id' in raw) {
    const linkId = raw['link_id'];
    if (linkId !== null && typeof linkId !== 'number') return { ok: false, code: 'invalid_link_id' };
    value.linkId = linkId;
  }
  if ('sort_order' in raw) {
    if (typeof raw['sort_order'] !== 'number') return { ok: false, code: 'invalid_sort_order' };
    value.sortOrder = raw['sort_order'];
  }
  if ('is_active' in raw) {
    if (typeof raw['is_active'] !== 'boolean') return { ok: false, code: 'invalid_is_active' };
    value.isActive = raw['is_active'];
  }
  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Product import
// ---------------------------------------------------------------------------

export interface ImportRequestInput {
  fileName: string;
  rows: Record<string, unknown>[];
}

export type ImportRequestValidationResult =
  | { ok: true; value: ImportRequestInput }
  | { ok: false; code: string };

export function validateImportRequestBody(raw: unknown, maxRows: number): ImportRequestValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, code: 'bad_request' };
  }
  const fileName = raw['file_name'];
  if (!isNonEmptyString(fileName)) {
    return { ok: false, code: 'invalid_file_name' };
  }
  const rows = raw['rows'];
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > maxRows) {
    return { ok: false, code: 'invalid_rows' };
  }
  for (const row of rows) {
    if (!isPlainObject(row)) {
      return { ok: false, code: 'invalid_rows' };
    }
  }
  return { ok: true, value: { fileName: fileName.trim(), rows: rows as Record<string, unknown>[] } };
}
