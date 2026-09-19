// In-memory mock backend used when VITE_MOCK=1. Dynamically imported by
// client.ts so its fixtures never reach the production bundle.
//
// Supports the same `?simulate=` dev hooks XUMO used, adapted to variants:
//   ?simulate=stock_changed  — checkout fails with a stock conflict once
//   ?simulate=price_changed  — checkout fails with a price conflict once
//   ?simulate=not_subscribed — GET /me reports channel_required=true

import type {
  Address,
  Banner,
  Brand,
  Category,
  Me,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  Product,
  ProductDetail,
  ProductVariant,
  ProductsPage,
  ProductsQuery,
  PublicSettings,
  Region,
} from './types.ts';
import type { AddressInput, ApiClient, OrderCreateInput, OrderCreateResult, OrdersPage, ProfileUpdateInput } from './client.ts';
import { ApiError } from './apiError.ts';
import { validateImportRow } from '@dunyo/shared';
import { buildKnownNameMap } from '../admin/importKnownMaps.ts';
import type {
  AdminApiClient,
  AdminBanner,
  AdminBrand,
  AdminCategory,
  AdminOrderDetail,
  AdminOrderSummary,
  AdminProduct,
  AdminRegion,
  AdminUserRow,
  AdminVariant,
  AuditLogEntry,
  ImportResult,
  ImportRowError,
  Paged,
  SettingsData,
} from '../admin/types.ts';

function simulateFlag(name: string): boolean {
  try {
    return new URLSearchParams(window.location.search).get('simulate') === name;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface MockVariant extends ProductVariant {
  productId: number;
}

interface MockProduct {
  id: number;
  name: string;
  brandId: number;
  categoryId: number;
  warrantyMonths: number;
  description: string;
  specs: Record<string, unknown>;
  soldCount: number;
  variants: MockVariant[];
}

const BRANDS: Brand[] = [
  { id: 1, name: 'Apple', logo_path: null },
  { id: 2, name: 'Samsung', logo_path: null },
  { id: 3, name: 'Xiaomi', logo_path: null },
  { id: 4, name: 'Anker', logo_path: null },
  { id: 5, name: 'JBL', logo_path: null },
  { id: 6, name: 'Baseus', logo_path: null },
  { id: 7, name: 'Honor', logo_path: null },
  { id: 8, name: "Bo'ka", logo_path: null },
];

const CATEGORIES: Category[] = [
  { id: 1, name: 'Smartfonlar', icon: 'smartphone' },
  { id: 2, name: 'Aksessuarlar', icon: 'cable' },
  { id: 3, name: 'Quloqchinlar', icon: 'headphones' },
  { id: 4, name: 'Smart soatlar', icon: 'watch' },
  { id: 5, name: "Zaryadlovchilar", icon: 'bolt' },
].map((c) => ({ ...c, image_path: null }));

const REGION_NAMES = [
  'Toshkent shahri',
  'Toshkent viloyati',
  'Andijon',
  'Fargʻona',
  'Namangan',
  'Samarqand',
  'Buxoro',
  'Xorazm',
  'Navoiy',
  'Qashqadaryo',
  'Surxondaryo',
  'Jizzax',
  'Sirdaryo',
  "Qoraqalpog'iston",
];

const REGIONS: Region[] = REGION_NAMES.map((name, i) => ({
  id: i + 1,
  name,
  delivery_fee: i === 0 ? 15_000 : 35_000,
  eta_text: i === 0 ? 'Bugun, 2-4 soat' : '1-2 kun',
  free_delivery_threshold: i === 0 ? 3_000_000 : null,
}));

let nextVariantId = 1;
function makeVariant(
  productId: number,
  partial: Omit<MockVariant, 'id' | 'productId' | 'sort_order'> & { sortOrder: number },
): MockVariant {
  const id = nextVariantId;
  nextVariantId += 1;
  return {
    id,
    productId,
    sku: partial.sku,
    color_name: partial.color_name,
    color_hex: partial.color_hex,
    storage_gb: partial.storage_gb,
    price: partial.price,
    old_price: partial.old_price,
    stock: partial.stock,
    image_thumb_path: partial.image_thumb_path,
    image_path: partial.image_path,
    sort_order: partial.sortOrder,
  };
}

const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: 1,
    name: 'iPhone 16 Pro',
    brandId: 1,
    categoryId: 1,
    warrantyMonths: 12,
    description: "Titanium korpus, A18 Pro chip, 48MP kamera. Rasmiy Dunyo Mobile kafolati bilan.",
    specs: { Ekran: '6.3"', Xotira: '256/512 GB', Batareya: '3582 mAh' },
    soldCount: 214,
    variants: [
      makeVariant(1, { sku: 'IP16P-DT-256', color_name: 'Desert Titanium', color_hex: '#8a7a63', storage_gb: 256, price: 15_450_000, old_price: 16_990_000, stock: 6, image_thumb_path: null, image_path: null, sortOrder: 0 }),
      makeVariant(1, { sku: 'IP16P-DT-512', color_name: 'Desert Titanium', color_hex: '#8a7a63', storage_gb: 512, price: 18_200_000, old_price: null, stock: 3, image_thumb_path: null, image_path: null, sortOrder: 1 }),
      makeVariant(1, { sku: 'IP16P-BT-256', color_name: 'Black Titanium', color_hex: '#2b2b2b', storage_gb: 256, price: 15_450_000, old_price: 16_990_000, stock: 0, image_thumb_path: null, image_path: null, sortOrder: 2 }),
    ],
  },
  {
    id: 2,
    name: 'Galaxy S24 Ultra',
    brandId: 2,
    categoryId: 1,
    warrantyMonths: 12,
    description: "Titanium ramka, S Pen bilan, 200MP kamera.",
    specs: { Ekran: '6.8"', Xotira: '256/512 GB', Batareya: '5000 mAh' },
    soldCount: 178,
    variants: [
      makeVariant(2, { sku: 'S24U-TG-256', color_name: 'Titanium Gray', color_hex: '#6b6b6b', storage_gb: 256, price: 14_200_000, old_price: null, stock: 5, image_thumb_path: null, image_path: null, sortOrder: 0 }),
      makeVariant(2, { sku: 'S24U-TV-512', color_name: 'Titanium Violet', color_hex: '#7b6b9e', storage_gb: 512, price: 16_800_000, old_price: null, stock: 2, image_thumb_path: null, image_path: null, sortOrder: 1 }),
    ],
  },
  {
    id: 3,
    name: 'iPhone 15',
    brandId: 1,
    categoryId: 1,
    warrantyMonths: 12,
    description: "Dynamic Island, A16 Bionic, 48MP asosiy kamera.",
    specs: { Ekran: '6.1"', Xotira: '128/256 GB' },
    soldCount: 340,
    variants: [
      makeVariant(3, { sku: 'IP15-BM-128', color_name: 'Black Midnight', color_hex: '#1c1c1e', storage_gb: 128, price: 9_850_000, old_price: null, stock: 11, image_thumb_path: null, image_path: null, sortOrder: 0 }),
    ],
  },
  {
    id: 4,
    name: 'Redmi Note 13 Pro+',
    brandId: 3,
    categoryId: 1,
    warrantyMonths: 12,
    description: "200MP kamera, 120W tezkor quvvatlash.",
    specs: { Ekran: '6.67"', Xotira: '256 GB' },
    soldCount: 512,
    variants: [
      makeVariant(4, { sku: 'RN13P-AP-256', color_name: 'Aurora Purple', color_hex: '#8a6bd9', storage_gb: 256, price: 3_950_000, old_price: 4_650_000, stock: 24, image_thumb_path: null, image_path: null, sortOrder: 0 }),
    ],
  },
  {
    id: 5,
    name: 'AirPods Pro 2 USB-C',
    brandId: 1,
    categoryId: 3,
    warrantyMonths: 12,
    description: "Faol shovqin bostirish, USB-C, Apple kafolati bilan.",
    specs: {},
    soldCount: 98,
    variants: [
      makeVariant(5, { sku: 'APP2-USBC', color_name: 'White', color_hex: '#f5f5f5', storage_gb: null, price: 2_890_000, old_price: null, stock: 14, image_thumb_path: null, image_path: null, sortOrder: 0 }),
    ],
  },
  {
    id: 6,
    name: 'Anker 20W + Type-C kabel',
    brandId: 4,
    categoryId: 5,
    warrantyMonths: 6,
    // Below INSTALLMENT_MIN_PRICE on purpose: the installment line must not render for this SKU.
    description: "iPhone va Android uchun tezkor quvvatlash to'plami.",
    specs: {},
    soldCount: 640,
    variants: [
      makeVariant(6, { sku: 'ANK-20W-KIT', color_name: 'White', color_hex: '#ffffff', storage_gb: null, price: 240_000, old_price: null, stock: 80, image_thumb_path: null, image_path: null, sortOrder: 0 }),
    ],
  },
  {
    id: 7,
    name: 'JBL Tune 720BT',
    brandId: 5,
    categoryId: 3,
    warrantyMonths: 12,
    description: "Simsiz over-ear quloqchin, 76 soatgacha batareya.",
    specs: {},
    soldCount: 210,
    variants: [
      makeVariant(7, { sku: 'JBL-T720', color_name: 'Black', color_hex: '#111111', storage_gb: null, price: 890_000, old_price: 990_000, stock: 18, image_thumb_path: null, image_path: null, sortOrder: 0 }),
    ],
  },
  {
    id: 8,
    name: 'Honor Magic 6 Pro',
    brandId: 7,
    categoryId: 1,
    warrantyMonths: 12,
    description: "180MP periskop kamera, 5600 mAh batareya.",
    specs: {},
    soldCount: 76,
    variants: [
      makeVariant(8, { sku: 'HM6P-GRN-512', color_name: 'Green', color_hex: '#2f5c46', storage_gb: 512, price: 11_400_000, old_price: null, stock: 4, image_thumb_path: null, image_path: null, sortOrder: 0 }),
    ],
  },
  {
    id: 9,
    name: 'Apple Watch Ultra 2',
    brandId: 1,
    categoryId: 4,
    warrantyMonths: 12,
    description: "Titanium korpus, 36 soat batareya, harbiy standart.",
    specs: {},
    soldCount: 54,
    variants: [
      makeVariant(9, { sku: 'AWU2-49', color_name: 'Titanium', color_hex: '#8a8a8a', storage_gb: null, price: 8_950_000, old_price: null, stock: 3, image_thumb_path: null, image_path: null, sortOrder: 0 }),
    ],
  },
  {
    id: 10,
    name: 'Baseus 65W GaN quvvatlovchi',
    brandId: 6,
    categoryId: 5,
    warrantyMonths: 6,
    description: "3 portli tezkor quvvatlovchi, noutbuklar uchun ham mos.",
    specs: {},
    soldCount: 302,
    variants: [
      makeVariant(10, { sku: 'BAS-65W', color_name: 'Black', color_hex: '#0f0f0f', storage_gb: null, price: 320_000, old_price: null, stock: 40, image_thumb_path: null, image_path: null, sortOrder: 0 }),
    ],
  },
];

const SETTINGS: PublicSettings = {
  min_order_amount: 100_000,
  free_delivery_threshold: 3_000_000,
  delivery_enabled: true,
  pickup_address: "Toshkent sh., Chilonzor tumani, Bunyodkor shoh ko'chasi 12",
  installment_months: 12,
  support_username: 'dunyo_mobile_support',
};

const BANNERS: Banner[] = [
  { id: 1, image_path: null, title: 'iPhone 16 Pro Max', subtitle: "Boshlang'ich to'lovsiz, 12 oyga teng taqsimotda!", link_type: 'product', link_id: 1 },
];

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

function allVariants(): MockVariant[] {
  return MOCK_PRODUCTS.flatMap((p) => p.variants);
}

function toProductCard(p: MockProduct): Product {
  const activeVariants = p.variants;
  const minPriceVariant = [...activeVariants].sort((a, b) => a.price - b.price || a.id - b.id)[0] ?? null;
  const totalStock = activeVariants.reduce((sum, v) => sum + v.stock, 0);
  const brand = BRANDS.find((b) => b.id === p.brandId);
  return {
    id: p.id,
    name: p.name,
    brand_id: p.brandId,
    brand_name: brand?.name ?? '',
    category_id: p.categoryId,
    category_icon: CATEGORIES.find((c) => c.id === p.categoryId)?.icon ?? null,
    warranty_months: p.warrantyMonths,
    min_price: minPriceVariant?.price ?? 0,
    old_price: minPriceVariant?.old_price ?? null,
    thumb: minPriceVariant?.image_thumb_path ?? null,
    total_stock: totalStock,
    variant_count: activeVariants.length,
    sold_count: p.soldCount,
  };
}

function toProductDetail(p: MockProduct): ProductDetail {
  const brand = BRANDS.find((b) => b.id === p.brandId);
  return {
    id: p.id,
    name: p.name,
    brand_id: p.brandId,
    brand_name: brand?.name ?? '',
    category_id: p.categoryId,
    category_icon: CATEGORIES.find((c) => c.id === p.categoryId)?.icon ?? null,
    warranty_months: p.warrantyMonths,
    description: p.description,
    specs: p.specs,
    variants: p.variants.map((v): ProductVariant => ({ ...v })),
  };
}

function sortProducts(cards: Product[], sort: ProductsQuery['sort']): Product[] {
  const sorted = [...cards];
  switch (sort) {
    case 'cheap':
      return sorted.sort((a, b) => a.min_price - b.min_price);
    case 'expensive':
      return sorted.sort((a, b) => b.min_price - a.min_price);
    case 'discount':
      return sorted.sort((a, b) => (b.old_price !== null ? 1 : 0) - (a.old_price !== null ? 1 : 0));
    case 'popular':
    default:
      return sorted.sort((a, b) => b.sold_count - a.sold_count);
  }
}

// ---------------------------------------------------------------------------
// Mutable state: favorites, addresses, orders, a used-idempotency-key map.
// ---------------------------------------------------------------------------

const favoriteProductIds = new Set<number>([1, 5]);
const addresses: Address[] = [
  { id: 1, region_id: 1, label: 'Uy', text: "Chilonzor tumani, 19-kvartal, 4-uy", lat: null, lng: null, is_default: true, created_at: new Date().toISOString() },
];
let nextAddressId = 2;

const orders: OrderDetail[] = [];
let nextOrderId = 1;
const idempotencySeen = new Map<string, number>();

let stockSimConsumed = false;
let priceSimConsumed = false;

// The mock user is an owner (not just an admin) so every admin screen,
// including the owner-only /admin/admins page, is reachable with VITE_MOCK=1.
const ME: Me = {
  id: 100000001,
  first_name: 'Aziz',
  last_name: 'Karimov',
  username: 'aziz_dev',
  phone: '+998901234567',
  phone_verified: true,
  is_admin: true,
  admin_role: 'owner',
  channel_required: false,
  channel_username: 'dunyo_mobile_channel',
};

function delay<T>(value: T, ms = 150): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export function createMockClient(): ApiClient {
  return {
    getSettings: () => delay(SETTINGS),
    getCategories: () => delay(CATEGORIES),
    getBrands: () => delay(BRANDS),
    getRegions: () => delay(REGIONS),
    getBanners: () => delay(BANNERS),

    getProducts: (query: ProductsQuery) => {
      let cards = MOCK_PRODUCTS.map(toProductCard);
      if (query.categoryId !== undefined) cards = cards.filter((c) => c.category_id === query.categoryId);
      if (query.brandId !== undefined) cards = cards.filter((c) => c.brand_id === query.brandId);
      if (query.q !== undefined && query.q.trim().length > 0) {
        const needle = query.q.trim().toLowerCase();
        cards = cards.filter((c) => c.name.toLowerCase().includes(needle));
      }
      if (query.discount === true) cards = cards.filter((c) => c.old_price !== null);
      cards = sortProducts(cards, query.sort);

      const pageSize = 20;
      const from = (query.page - 1) * pageSize;
      const page: ProductsPage = {
        items: cards.slice(from, from + pageSize),
        total: cards.length,
        page: query.page,
        pageSize,
      };
      return delay(page);
    },

    getProductsByIds: (ids: number[]) => delay(MOCK_PRODUCTS.filter((p) => ids.includes(p.id)).map(toProductCard)),

    getProductById: (id: number) => {
      const product = MOCK_PRODUCTS.find((p) => p.id === id);
      if (product === undefined) {
        return Promise.reject(new ApiError(404, 'not_found', 'Product not found'));
      }
      return delay(toProductDetail(product));
    },

    getMe: () => delay({ ...ME, channel_required: simulateFlag('not_subscribed') }),
    patchMe: (input: ProfileUpdateInput) => {
      if (input.firstName !== undefined) ME.first_name = input.firstName;
      if (input.lastName !== undefined) ME.last_name = input.lastName;
      if (input.phone !== undefined) {
        ME.phone = input.phone;
        ME.phone_verified = true;
      }
      return delay({ ...ME });
    },
    postContact: () => {
      ME.phone_verified = true;
      return delay({ ...ME });
    },
    postChannelCheck: () => delay({ ...ME, channel_required: false }),

    getFavorites: () => delay(MOCK_PRODUCTS.filter((p) => favoriteProductIds.has(p.id)).map(toProductCard)),
    putFavorite: (productId: number) => {
      favoriteProductIds.add(productId);
      return delay(undefined);
    },
    deleteFavorite: (productId: number) => {
      favoriteProductIds.delete(productId);
      return delay(undefined);
    },

    getAddresses: () => delay([...addresses]),
    postAddress: (input: AddressInput) => {
      const row: Address = {
        id: nextAddressId,
        region_id: input.regionId,
        label: input.label,
        text: input.text,
        lat: input.lat,
        lng: input.lng,
        is_default: input.isDefault,
        created_at: new Date().toISOString(),
      };
      nextAddressId += 1;
      if (input.isDefault) {
        for (const a of addresses) a.is_default = false;
      }
      addresses.push(row);
      return delay(row);
    },
    patchAddress: (id: number, input: AddressInput) => {
      const row = addresses.find((a) => a.id === id);
      if (row === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Address not found'));
      row.region_id = input.regionId;
      row.label = input.label;
      row.text = input.text;
      row.lat = input.lat;
      row.lng = input.lng;
      row.is_default = input.isDefault;
      if (input.isDefault) {
        for (const a of addresses) if (a.id !== id) a.is_default = false;
      }
      return delay({ ...row });
    },
    deleteAddress: (id: number) => {
      const idx = addresses.findIndex((a) => a.id === id);
      if (idx >= 0) addresses.splice(idx, 1);
      return delay(undefined);
    },

    postOrder: (input: OrderCreateInput) => {
      const existingOrderId = idempotencySeen.get(input.idempotencyKey);
      if (existingOrderId !== undefined) {
        const existing = orders.find((o) => o.id === existingOrderId);
        if (existing !== undefined) {
          return delay<OrderCreateResult>({ order_id: existing.id, order_no: existing.order_no, duplicate: true });
        }
      }

      if (input.deliveryType === 'delivery' && !SETTINGS.delivery_enabled) {
        return Promise.reject(new ApiError(422, 'delivery_disabled', 'Delivery disabled'));
      }

      if (simulateFlag('stock_changed') && !stockSimConsumed) {
        stockSimConsumed = true;
        const first = input.items[0];
        return Promise.reject(
          new ApiError(409, 'stock_changed', 'Stock changed', {
            items: first !== undefined ? [{ variant_id: first.variant_id, available: 0 }] : [],
          }),
        );
      }
      if (simulateFlag('price_changed') && !priceSimConsumed) {
        priceSimConsumed = true;
        const first = input.items[0];
        return Promise.reject(
          new ApiError(409, 'price_changed', 'Price changed', {
            items: first !== undefined ? [{ variant_id: first.variant_id, price: first.expected_price + 50_000 }] : [],
          }),
        );
      }

      const lookup = new Map(allVariants().map((v) => [v.id, v]));
      for (const item of input.items) {
        const variant = lookup.get(item.variant_id);
        if (variant === undefined || variant.stock < item.qty) {
          return Promise.reject(
            new ApiError(409, 'stock_changed', 'Stock changed', {
              items: [{ variant_id: item.variant_id, available: variant?.stock ?? 0 }],
            }),
          );
        }
        if (variant.price !== item.expected_price) {
          return Promise.reject(
            new ApiError(409, 'price_changed', 'Price changed', {
              items: [{ variant_id: item.variant_id, price: variant.price }],
            }),
          );
        }
      }

      const itemsTotal = input.items.reduce((sum, item) => {
        const variant = lookup.get(item.variant_id);
        return sum + (variant?.price ?? 0) * item.qty;
      }, 0);
      if (itemsTotal < SETTINGS.min_order_amount) {
        return Promise.reject(
          new ApiError(422, 'min_order', 'Below minimum order', {
            min_order_amount: SETTINGS.min_order_amount,
            items_total: itemsTotal,
          }),
        );
      }

      for (const item of input.items) {
        const variant = lookup.get(item.variant_id);
        if (variant !== undefined) variant.stock -= item.qty;
      }

      const region = REGIONS.find((r) => r.id === input.regionId) ?? null;
      const deliveryFee =
        input.deliveryType === 'pickup'
          ? 0
          : itemsTotal >= (region?.free_delivery_threshold ?? SETTINGS.free_delivery_threshold)
            ? 0
            : (region?.delivery_fee ?? 0);

      const orderId = nextOrderId;
      nextOrderId += 1;
      const orderNo = `DM-${String(100000 + orderId).slice(1)}`;
      const now = new Date().toISOString();
      const order: OrderDetail = {
        id: orderId,
        order_no: orderNo,
        status: 'new' as OrderStatus,
        delivery_type: input.deliveryType,
        payment_method: input.paymentMethod,
        tracking_note: null,
        items_total: itemsTotal,
        delivery_fee: deliveryFee,
        grand_total: itemsTotal + deliveryFee,
        created_at: now,
        region_id: input.regionId,
        region_name: region?.name ?? null,
        address_text: input.addressText,
        lat: input.lat,
        lng: input.lng,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        comment: input.comment,
        discount_total: 0,
        installment_months: input.paymentMethod === 'installment_request' ? SETTINGS.installment_months : null,
        items: input.items.map((item) => {
          const variant = lookup.get(item.variant_id);
          const product = MOCK_PRODUCTS.find((p) => p.variants.some((v) => v.id === item.variant_id));
          return {
            variant_id: item.variant_id,
            product_id: product?.id ?? 0,
            name_snapshot: product?.name ?? '',
            color_snapshot: variant?.color_name ?? '',
            storage_snapshot: variant?.storage_gb ?? null,
            price_snapshot: item.expected_price,
            old_price_snapshot: variant?.old_price ?? null,
            warranty_snapshot: product?.warrantyMonths ?? 0,
            qty: item.qty,
          };
        }),
        history: [{ from_status: null, to_status: 'new', changed_by: null, created_at: now }],
      };
      orders.unshift(order);
      idempotencySeen.set(input.idempotencyKey, orderId);

      return delay<OrderCreateResult>({ order_id: orderId, order_no: orderNo, duplicate: false });
    },

    getOrders: (page: number) => {
      const summaries: OrderSummary[] = orders.map((o) => ({
        id: o.id,
        order_no: o.order_no,
        status: o.status,
        delivery_type: o.delivery_type,
        payment_method: o.payment_method,
        tracking_note: o.tracking_note,
        items_total: o.items_total,
        delivery_fee: o.delivery_fee,
        grand_total: o.grand_total,
        created_at: o.created_at,
      }));
      const result: OrdersPage = { items: summaries, total: summaries.length, page, pageSize: 20 };
      return delay(result);
    },
    getOrderById: (id: number) => {
      const order = orders.find((o) => o.id === id);
      if (order === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Order not found'));
      return delay({ ...order });
    },
  };
}

// ---------------------------------------------------------------------------
// Admin mock — VITE_MOCK=1's admin/adminClient.ts pulls in createAdminMockClient
// from this same module (mirrors the customer client's mock/real split).
// Fixtures below are independent, admin-shaped copies of the catalog data
// above (not the same array objects) — the mock is demo-only, in-memory data
// with no real persistence, so keeping two coherent-but-separate catalogs is
// a reasonable trade against the complexity of a fully shared store. Orders
// ARE shared (the same `orders` array the customer checkout flow pushes to),
// so an order placed via VITE_MOCK=1 checkout is immediately visible here.
// ---------------------------------------------------------------------------

let nextAdminBrandId = BRANDS.length + 1;
const ADMIN_BRANDS: AdminBrand[] = BRANDS.map((b, i) => ({ id: b.id, name: b.name, logo_path: b.logo_path, sort_order: i, is_active: true }));

let nextAdminCategoryId = CATEGORIES.length + 1;
const ADMIN_CATEGORIES: AdminCategory[] = CATEGORIES.map((c, i) => ({
  id: c.id,
  name: c.name,
  icon: c.icon,
  image_path: c.image_path,
  sort_order: i,
  is_active: true,
}));

let nextAdminRegionId = REGIONS.length + 1;
const ADMIN_REGIONS: AdminRegion[] = REGIONS.map((r, i) => ({
  id: r.id,
  name: r.name,
  delivery_fee: r.delivery_fee,
  eta_text: r.eta_text,
  free_delivery_threshold: r.free_delivery_threshold,
  sort_order: i,
  is_active: true,
}));

let nextAdminBannerId = BANNERS.length + 1;
const ADMIN_BANNERS: AdminBanner[] = BANNERS.map((b, i) => ({
  id: b.id,
  image_path: b.image_path,
  title: b.title,
  subtitle: b.subtitle,
  link_type: b.link_type,
  link_id: b.link_id,
  sort_order: i,
  is_active: true,
}));

const nowIso = (): string => new Date().toISOString();

let nextAdminProductId = Math.max(0, ...MOCK_PRODUCTS.map((p) => p.id)) + 1;
const ADMIN_PRODUCTS: AdminProduct[] = MOCK_PRODUCTS.map((p) => ({
  id: p.id,
  name: p.name,
  brand_id: p.brandId,
  category_id: p.categoryId,
  description: p.description,
  warranty_months: p.warrantyMonths,
  specs: p.specs,
  is_active: true,
  sold_count: p.soldCount,
  created_at: nowIso(),
  updated_at: nowIso(),
}));

let nextAdminVariantId = Math.max(0, ...MOCK_PRODUCTS.flatMap((p) => p.variants.map((v) => v.id))) + 1;
const ADMIN_VARIANTS: AdminVariant[] = MOCK_PRODUCTS.flatMap((p) =>
  p.variants.map((v) => ({
    id: v.id,
    product_id: p.id,
    sku: v.sku,
    color_name: v.color_name,
    color_hex: v.color_hex,
    storage_gb: v.storage_gb,
    price: v.price,
    old_price: v.old_price,
    stock: v.stock,
    image_thumb_path: v.image_thumb_path,
    image_path: v.image_path,
    sort_order: v.sort_order,
    is_active: true,
    created_at: nowIso(),
    updated_at: nowIso(),
  })),
);

const ADMIN_SETTINGS: SettingsData = {
  min_order_amount: SETTINGS.min_order_amount,
  free_delivery_threshold: SETTINGS.free_delivery_threshold,
  delivery_enabled: SETTINGS.delivery_enabled,
  shop_group_chat_id: null,
  pickup_address: SETTINGS.pickup_address,
  required_channel: null,
  installment_months: SETTINGS.installment_months,
  support_username: SETTINGS.support_username,
};

const ADMIN_USERS: AdminUserRow[] = [
  { telegram_id: ME.id, role: 'owner', added_by: null, created_at: nowIso() },
  { telegram_id: 700000002, role: 'admin', added_by: ME.id, created_at: nowIso() },
];

let nextAuditId = 1;
const AUDIT_LOG: AuditLogEntry[] = [];

function pushAudit(action: string, entity: string, entityId: number | null, before: unknown, after: unknown): void {
  AUDIT_LOG.unshift({
    id: nextAuditId++,
    admin_id: ME.id,
    action,
    entity,
    entity_id: entityId,
    before: (before ?? null) as Record<string, unknown> | null,
    after: (after ?? null) as Record<string, unknown> | null,
    created_at: nowIso(),
  });
}

function toAdminOrderSummary(o: OrderDetail): AdminOrderSummary {
  return {
    id: o.id,
    order_no: o.order_no,
    user_id: ME.id,
    status: o.status,
    delivery_type: o.delivery_type,
    region_id: o.region_id,
    region_name: o.region_name,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    payment_method: o.payment_method,
    tracking_note: o.tracking_note,
    items_total: o.items_total,
    discount_total: o.discount_total,
    delivery_fee: o.delivery_fee,
    grand_total: o.grand_total,
    installment_months: o.installment_months,
    created_at: o.created_at,
  };
}

function toAdminOrderDetail(o: OrderDetail): AdminOrderDetail {
  return {
    ...toAdminOrderSummary(o),
    address_text: o.address_text,
    lat: o.lat,
    lng: o.lng,
    comment: o.comment,
    items: o.items.map((it) => ({
      variant_id: it.variant_id,
      product_id: it.product_id,
      name_snapshot: it.name_snapshot,
      color_snapshot: it.color_snapshot,
      storage_snapshot: it.storage_snapshot,
      price_snapshot: it.price_snapshot,
      old_price_snapshot: it.old_price_snapshot,
      warranty_snapshot: it.warranty_snapshot,
      qty: it.qty,
    })),
    history: o.history.map((h) => ({ from_status: h.from_status, to_status: h.to_status, changed_by: null, created_at: h.created_at })),
  };
}

export function createAdminMockClient(): AdminApiClient {
  return {
    async getProducts({ q, brandId, categoryId, page }) {
      let items = ADMIN_PRODUCTS.slice();
      if (q !== undefined && q.trim().length > 0) {
        const needle = q.trim().toLowerCase();
        items = items.filter((p) => p.name.toLowerCase().includes(needle));
      }
      if (brandId !== undefined) items = items.filter((p) => p.brand_id === brandId);
      if (categoryId !== undefined) items = items.filter((p) => p.category_id === categoryId);
      const pageSize = 20;
      const from = (page - 1) * pageSize;
      const paged: Paged<AdminProduct> = { items: items.slice(from, from + pageSize), total: items.length, page };
      return delay(paged);
    },
    getProduct: (id) => {
      const product = ADMIN_PRODUCTS.find((p) => p.id === id);
      if (product === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Product not found'));
      return delay({ ...product });
    },
    createProduct: (input) => {
      const row: AdminProduct = {
        id: nextAdminProductId++,
        name: input.name,
        brand_id: input.brandId,
        category_id: input.categoryId,
        description: input.description,
        warranty_months: input.warrantyMonths,
        specs: input.specs,
        is_active: input.isActive,
        sold_count: 0,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      ADMIN_PRODUCTS.push(row);
      pushAudit('product_create', 'products', row.id, null, row);
      return delay(row);
    },
    updateProduct: (id, input) => {
      const product = ADMIN_PRODUCTS.find((p) => p.id === id);
      if (product === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Product not found'));
      const before = { ...product };
      product.name = input.name;
      product.brand_id = input.brandId;
      product.category_id = input.categoryId;
      product.description = input.description;
      product.warranty_months = input.warrantyMonths;
      product.specs = input.specs;
      product.is_active = input.isActive;
      product.updated_at = nowIso();
      pushAudit('product_update', 'products', id, before, product);
      return delay({ ...product });
    },
    deleteProduct: (id) => {
      const product = ADMIN_PRODUCTS.find((p) => p.id === id);
      if (product === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Product not found'));
      const before = { ...product };
      product.is_active = false;
      pushAudit('product_delete', 'products', id, before, product);
      return delay(undefined);
    },
    importProducts: (_fileName, rows) => {
      const knownBrands = buildKnownNameMap(ADMIN_BRANDS);
      const knownCategories = buildKnownNameMap(ADMIN_CATEGORIES);
      let created = 0;
      let updated = 0;
      const errors: ImportRowError[] = [];
      rows.forEach((raw, index) => {
        const rowNumber = index + 1;
        const result = validateImportRow(raw, rowNumber, knownBrands, knownCategories);
        if (!result.ok) {
          errors.push({ rowNumber: result.rowNumber, errors: result.errors });
          return;
        }
        const v = result.value;
        let product = ADMIN_PRODUCTS.find((p) => p.name === v.name && p.brand_id === v.brandId);
        if (product === undefined) {
          product = {
            id: nextAdminProductId++,
            name: v.name,
            brand_id: v.brandId,
            category_id: v.categoryId,
            description: null,
            warranty_months: v.warrantyMonths,
            specs: {},
            is_active: true,
            sold_count: 0,
            created_at: nowIso(),
            updated_at: nowIso(),
          };
          ADMIN_PRODUCTS.push(product);
        }
        const existingVariant =
          v.sku !== null
            ? ADMIN_VARIANTS.find((x) => x.sku === v.sku)
            : ADMIN_VARIANTS.find((x) => x.product_id === product!.id && x.color_name === v.colorName && x.storage_gb === v.storageGb);
        if (existingVariant === undefined) {
          ADMIN_VARIANTS.push({
            id: nextAdminVariantId++,
            product_id: product.id,
            sku: v.sku,
            color_name: v.colorName,
            color_hex: null,
            storage_gb: v.storageGb,
            price: v.price,
            old_price: v.oldPrice,
            stock: v.stock,
            image_thumb_path: null,
            image_path: null,
            sort_order: 0,
            is_active: true,
            created_at: nowIso(),
            updated_at: nowIso(),
          });
          created += 1;
        } else {
          existingVariant.sku = v.sku;
          existingVariant.color_name = v.colorName;
          existingVariant.storage_gb = v.storageGb;
          existingVariant.price = v.price;
          existingVariant.old_price = v.oldPrice;
          existingVariant.stock = v.stock;
          existingVariant.updated_at = nowIso();
          updated += 1;
        }
      });
      const result: ImportResult = { created, updated, errors };
      pushAudit('product_import', 'products', null, null, { created, updated, errors: errors.length });
      return delay(result);
    },

    getVariants: (productId) => delay(ADMIN_VARIANTS.filter((v) => v.product_id === productId).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)),
    createVariant: (productId, input) => {
      const row: AdminVariant = {
        id: nextAdminVariantId++,
        product_id: productId,
        sku: input.sku,
        color_name: input.colorName,
        color_hex: input.colorHex,
        storage_gb: input.storageGb,
        price: input.price,
        old_price: input.oldPrice,
        stock: input.stock,
        image_thumb_path: null,
        image_path: null,
        sort_order: input.sortOrder,
        is_active: input.isActive,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      ADMIN_VARIANTS.push(row);
      pushAudit('variant_create', 'product_variants', row.id, null, row);
      return delay(row);
    },
    updateVariant: (id, input) => {
      const variant = ADMIN_VARIANTS.find((v) => v.id === id);
      if (variant === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Variant not found'));
      const before = { ...variant };
      variant.sku = input.sku;
      variant.color_name = input.colorName;
      variant.color_hex = input.colorHex;
      variant.storage_gb = input.storageGb;
      variant.price = input.price;
      variant.old_price = input.oldPrice;
      variant.stock = input.stock;
      variant.sort_order = input.sortOrder;
      variant.is_active = input.isActive;
      variant.updated_at = nowIso();
      pushAudit('variant_update', 'product_variants', id, before, variant);
      return delay({ ...variant });
    },
    deleteVariant: (id) => {
      const variant = ADMIN_VARIANTS.find((v) => v.id === id);
      if (variant === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Variant not found'));
      const before = { ...variant };
      variant.is_active = false;
      pushAudit('variant_delete', 'product_variants', id, before, variant);
      return delay(undefined);
    },
    uploadVariantImage: (id, thumb, main) => {
      const variant = ADMIN_VARIANTS.find((v) => v.id === id);
      if (variant === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Variant not found'));
      variant.image_thumb_path = URL.createObjectURL(thumb);
      variant.image_path = URL.createObjectURL(main);
      variant.updated_at = nowIso();
      pushAudit('variant_image', 'product_variants', id, null, { image_thumb_path: variant.image_thumb_path, image_path: variant.image_path });
      return delay({ ...variant });
    },

    getCategories: () => delay(ADMIN_CATEGORIES.slice().sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)),
    createCategory: (input) => {
      const row: AdminCategory = { id: nextAdminCategoryId++, name: input.name, icon: input.icon, image_path: null, sort_order: input.sortOrder, is_active: input.isActive };
      ADMIN_CATEGORIES.push(row);
      pushAudit('category_create', 'categories', row.id, null, row);
      return delay(row);
    },
    updateCategory: (id, input) => {
      const category = ADMIN_CATEGORIES.find((c) => c.id === id);
      if (category === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Category not found'));
      const before = { ...category };
      if (input.name !== undefined) category.name = input.name;
      if (input.icon !== undefined) category.icon = input.icon;
      if (input.sortOrder !== undefined) category.sort_order = input.sortOrder;
      if (input.isActive !== undefined) category.is_active = input.isActive;
      pushAudit('category_update', 'categories', id, before, category);
      return delay({ ...category });
    },
    deleteCategory: (id) => {
      const category = ADMIN_CATEGORIES.find((c) => c.id === id);
      if (category === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Category not found'));
      const before = { ...category };
      category.is_active = false;
      pushAudit('category_delete', 'categories', id, before, category);
      return delay(undefined);
    },

    getBrands: () => delay(ADMIN_BRANDS.slice().sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)),
    createBrand: (input) => {
      const row: AdminBrand = { id: nextAdminBrandId++, name: input.name, logo_path: null, sort_order: input.sortOrder, is_active: input.isActive };
      ADMIN_BRANDS.push(row);
      pushAudit('brand_create', 'brands', row.id, null, row);
      return delay(row);
    },
    updateBrand: (id, input) => {
      const brand = ADMIN_BRANDS.find((b) => b.id === id);
      if (brand === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Brand not found'));
      const before = { ...brand };
      brand.name = input.name;
      brand.sort_order = input.sortOrder;
      brand.is_active = input.isActive;
      pushAudit('brand_update', 'brands', id, before, brand);
      return delay({ ...brand });
    },
    deleteBrand: (id) => {
      const brand = ADMIN_BRANDS.find((b) => b.id === id);
      if (brand === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Brand not found'));
      const before = { ...brand };
      brand.is_active = false;
      pushAudit('brand_delete', 'brands', id, before, brand);
      return delay(undefined);
    },

    getRegions: () => delay(ADMIN_REGIONS.slice().sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)),
    createRegion: (input) => {
      const row: AdminRegion = {
        id: nextAdminRegionId++,
        name: input.name,
        delivery_fee: input.deliveryFee,
        eta_text: input.etaText,
        free_delivery_threshold: input.freeDeliveryThreshold,
        sort_order: input.sortOrder,
        is_active: input.isActive,
      };
      ADMIN_REGIONS.push(row);
      pushAudit('region_create', 'regions', row.id, null, row);
      return delay(row);
    },
    updateRegion: (id, input) => {
      const region = ADMIN_REGIONS.find((r) => r.id === id);
      if (region === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Region not found'));
      const before = { ...region };
      region.name = input.name;
      region.delivery_fee = input.deliveryFee;
      region.eta_text = input.etaText;
      region.free_delivery_threshold = input.freeDeliveryThreshold;
      region.sort_order = input.sortOrder;
      region.is_active = input.isActive;
      pushAudit('region_update', 'regions', id, before, region);
      return delay({ ...region });
    },
    deleteRegion: (id) => {
      const region = ADMIN_REGIONS.find((r) => r.id === id);
      if (region === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Region not found'));
      const before = { ...region };
      region.is_active = false;
      pushAudit('region_delete', 'regions', id, before, region);
      return delay(undefined);
    },

    getBanners: () => delay(ADMIN_BANNERS.slice().sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)),
    createBanner: (input) => {
      const row: AdminBanner = {
        id: nextAdminBannerId++,
        image_path: null,
        title: input.title,
        subtitle: input.subtitle,
        link_type: input.linkType,
        link_id: input.linkId,
        sort_order: input.sortOrder,
        is_active: input.isActive,
      };
      ADMIN_BANNERS.push(row);
      pushAudit('banner_create', 'banners', row.id, null, row);
      return delay(row);
    },
    updateBanner: (id, input) => {
      const banner = ADMIN_BANNERS.find((b) => b.id === id);
      if (banner === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Banner not found'));
      const before = { ...banner };
      if (input.title !== undefined) banner.title = input.title;
      if (input.subtitle !== undefined) banner.subtitle = input.subtitle;
      if (input.linkType !== undefined) banner.link_type = input.linkType;
      if (input.linkId !== undefined) banner.link_id = input.linkId;
      if (input.sortOrder !== undefined) banner.sort_order = input.sortOrder;
      if (input.isActive !== undefined) banner.is_active = input.isActive;
      pushAudit('banner_update', 'banners', id, before, banner);
      return delay({ ...banner });
    },
    deleteBanner: (id) => {
      const banner = ADMIN_BANNERS.find((b) => b.id === id);
      if (banner === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Banner not found'));
      const before = { ...banner };
      banner.is_active = false;
      pushAudit('banner_delete', 'banners', id, before, banner);
      return delay(undefined);
    },
    uploadBannerImage: (id, image) => {
      const banner = ADMIN_BANNERS.find((b) => b.id === id);
      if (banner === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Banner not found'));
      banner.image_path = URL.createObjectURL(image);
      pushAudit('banner_image', 'banners', id, null, { image_path: banner.image_path });
      return delay({ ...banner });
    },

    async getOrders({ status, regionId, page }) {
      let items = orders.map(toAdminOrderSummary);
      if (status !== undefined) items = items.filter((o) => o.status === status);
      if (regionId !== undefined) items = items.filter((o) => o.region_id === regionId);
      const pageSize = 20;
      const from = (page - 1) * pageSize;
      const paged: Paged<AdminOrderSummary> = { items: items.slice(from, from + pageSize), total: items.length, page };
      return delay(paged);
    },
    getOrder: (id) => {
      const order = orders.find((o) => o.id === id);
      if (order === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Order not found'));
      return delay(toAdminOrderDetail(order));
    },
    setOrderStatus: (id, status, trackingNote) => {
      const order = orders.find((o) => o.id === id);
      if (order === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Order not found'));
      const before = order.status;
      order.status = status;
      if (trackingNote !== null) order.tracking_note = trackingNote;
      order.history.push({ from_status: before, to_status: status, changed_by: null, created_at: nowIso() });
      return delay({ order_id: order.id, status: order.status });
    },

    getSettings: () => delay({ ...ADMIN_SETTINGS }),
    updateSettings: (input) => {
      const before = { ...ADMIN_SETTINGS };
      if (input.freeDeliveryThreshold !== undefined) ADMIN_SETTINGS.free_delivery_threshold = input.freeDeliveryThreshold;
      if (input.minOrderAmount !== undefined) ADMIN_SETTINGS.min_order_amount = input.minOrderAmount;
      if (input.deliveryEnabled !== undefined) ADMIN_SETTINGS.delivery_enabled = input.deliveryEnabled;
      if (input.shopGroupChatId !== undefined) ADMIN_SETTINGS.shop_group_chat_id = input.shopGroupChatId;
      if (input.pickupAddress !== undefined) ADMIN_SETTINGS.pickup_address = input.pickupAddress;
      if (input.requiredChannel !== undefined) ADMIN_SETTINGS.required_channel = input.requiredChannel;
      if (input.installmentMonths !== undefined) ADMIN_SETTINGS.installment_months = input.installmentMonths;
      if (input.supportUsername !== undefined) ADMIN_SETTINGS.support_username = input.supportUsername;
      // Also reflected into the customer-facing SETTINGS singleton so the
      // rest of the mock (checkout, delivery calculations) stays consistent.
      SETTINGS.min_order_amount = ADMIN_SETTINGS.min_order_amount;
      SETTINGS.free_delivery_threshold = ADMIN_SETTINGS.free_delivery_threshold;
      SETTINGS.delivery_enabled = ADMIN_SETTINGS.delivery_enabled;
      SETTINGS.pickup_address = ADMIN_SETTINGS.pickup_address;
      SETTINGS.installment_months = ADMIN_SETTINGS.installment_months;
      SETTINGS.support_username = ADMIN_SETTINGS.support_username;
      pushAudit('settings_update', 'settings', 1, before, ADMIN_SETTINGS);
      return delay({ ...ADMIN_SETTINGS });
    },

    getAdmins: () => delay(ADMIN_USERS.slice()),
    addAdmin: (telegramId) => {
      if (ADMIN_USERS.some((a) => a.telegram_id === telegramId)) {
        return Promise.reject(new ApiError(422, 'already_admin', 'Already an admin'));
      }
      const row: AdminUserRow = { telegram_id: telegramId, role: 'admin', added_by: ME.id, created_at: nowIso() };
      ADMIN_USERS.push(row);
      pushAudit('admin_create', 'admin_users', telegramId, null, row);
      return delay(row);
    },
    deleteAdmin: (telegramId) => {
      if (telegramId === ME.id) {
        return Promise.reject(new ApiError(422, 'cannot_delete_self', 'Owner cannot delete self'));
      }
      const target = ADMIN_USERS.find((a) => a.telegram_id === telegramId);
      if (target === undefined) return Promise.reject(new ApiError(404, 'not_found', 'Admin not found'));
      if (target.role === 'owner' && ADMIN_USERS.filter((a) => a.role === 'owner').length <= 1) {
        return Promise.reject(new ApiError(422, 'cannot_delete_last_owner', 'Cannot delete the last owner'));
      }
      const idx = ADMIN_USERS.findIndex((a) => a.telegram_id === telegramId);
      ADMIN_USERS.splice(idx, 1);
      pushAudit('admin_delete', 'admin_users', telegramId, target, null);
      return delay(undefined);
    },

    getAudit: (page) => {
      const pageSize = 20;
      const from = (page - 1) * pageSize;
      const paged: Paged<AuditLogEntry> = { items: AUDIT_LOG.slice(from, from + pageSize), total: AUDIT_LOG.length, page };
      return delay(paged);
    },
  };
}
