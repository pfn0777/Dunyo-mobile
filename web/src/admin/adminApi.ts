// Real admin API client: every call hits the Fastify API under /admin/*,
// authenticated the same way as customer calls (`Authorization: tma
// <initData>`). Kept separate from lib/api.ts so the customer bundle never
// pulls in admin request/response shapes. Mirrors lib/api.ts's error
// handling exactly (same ApiError parsing, same auth-invalid side effect).

import { config } from '../lib/config.ts';
import { getInitData } from '../lib/telegram.ts';
import { ApiError } from '../lib/apiError.ts';
import { setAuthInvalid } from '../lib/authState.ts';
import type { OrderStatus } from '../lib/types.ts';
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
  BannerFormInput,
  BrandFormInput,
  CategoryFormInput,
  ImportResult,
  Paged,
  ProductFormInput,
  RegionFormInput,
  SettingsData,
  SettingsFormInput,
  VariantFormInput,
} from './types.ts';

async function adminCall<T>(path: string, method: string, body?: unknown): Promise<T> {
  const initData = getInitData();
  if (initData === null) {
    setAuthInvalid(true);
    throw new ApiError(401, 'auth_invalid', 'Not running inside Telegram');
  }
  const res = await fetch(`${config.apiUrl}/admin${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `tma ${initData}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseResponse<T>(res);
}

async function adminCallForm<T>(path: string, form: FormData): Promise<T> {
  const initData = getInitData();
  if (initData === null) {
    setAuthInvalid(true);
    throw new ApiError(401, 'auth_invalid', 'Not running inside Telegram');
  }
  const res = await fetch(`${config.apiUrl}/admin${path}`, {
    method: 'POST',
    headers: { Authorization: `tma ${initData}` },
    body: form,
  });
  return parseResponse<T>(res);
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const error = (json['error'] ?? {}) as { code?: string; message?: string; details?: Record<string, unknown> };
    const code = error.code ?? 'unknown';
    if (res.status === 401 && code === 'auth_invalid') {
      setAuthInvalid(true);
    }
    throw new ApiError(res.status, code, error.message ?? 'Request failed', error.details);
  }
  return json as T;
}

function productBody(input: ProductFormInput): Record<string, unknown> {
  return {
    name: input.name,
    brand_id: input.brandId,
    category_id: input.categoryId,
    warranty_months: input.warrantyMonths,
    description: input.description,
    specs: input.specs,
    is_active: input.isActive,
  };
}

function variantBody(input: VariantFormInput): Record<string, unknown> {
  return {
    sku: input.sku,
    color_name: input.colorName,
    color_hex: input.colorHex,
    storage_gb: input.storageGb,
    price: input.price,
    old_price: input.oldPrice,
    stock: input.stock,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  };
}

function categoryBody(input: Partial<CategoryFormInput>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body['name'] = input.name;
  if (input.icon !== undefined) body['icon'] = input.icon;
  if (input.sortOrder !== undefined) body['sort_order'] = input.sortOrder;
  if (input.isActive !== undefined) body['is_active'] = input.isActive;
  return body;
}

function brandBody(input: BrandFormInput): Record<string, unknown> {
  return { name: input.name, sort_order: input.sortOrder, is_active: input.isActive };
}

function regionBody(input: RegionFormInput): Record<string, unknown> {
  return {
    name: input.name,
    delivery_fee: input.deliveryFee,
    eta_text: input.etaText,
    free_delivery_threshold: input.freeDeliveryThreshold,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  };
}

function bannerBody(input: Partial<BannerFormInput>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body['title'] = input.title;
  if (input.subtitle !== undefined) body['subtitle'] = input.subtitle;
  if (input.linkType !== undefined) body['link_type'] = input.linkType;
  if (input.linkId !== undefined) body['link_id'] = input.linkId;
  if (input.sortOrder !== undefined) body['sort_order'] = input.sortOrder;
  if (input.isActive !== undefined) body['is_active'] = input.isActive;
  return body;
}

function settingsBody(input: SettingsFormInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.freeDeliveryThreshold !== undefined) body['free_delivery_threshold'] = input.freeDeliveryThreshold;
  if (input.minOrderAmount !== undefined) body['min_order_amount'] = input.minOrderAmount;
  if (input.deliveryEnabled !== undefined) body['delivery_enabled'] = input.deliveryEnabled;
  if (input.shopGroupChatId !== undefined) body['shop_group_chat_id'] = input.shopGroupChatId;
  if (input.pickupAddress !== undefined) body['pickup_address'] = input.pickupAddress;
  if (input.requiredChannel !== undefined) body['required_channel'] = input.requiredChannel;
  if (input.installmentMonths !== undefined) body['installment_months'] = input.installmentMonths;
  if (input.supportUsername !== undefined) body['support_username'] = input.supportUsername;
  return body;
}

export const adminApiClient: AdminApiClient = {
  async getProducts({ q, brandId, categoryId, page }) {
    const qs = new URLSearchParams({ page: String(page) });
    if (q !== undefined && q.trim().length > 0) qs.set('q', q.trim());
    if (brandId !== undefined) qs.set('brand_id', String(brandId));
    if (categoryId !== undefined) qs.set('category_id', String(categoryId));
    const res = await adminCall<{ items: AdminProduct[]; page: number; total: number | null }>(
      `/products?${qs.toString()}`,
      'GET',
    );
    return { items: res.items, total: res.total ?? res.items.length, page: res.page };
  },
  getProduct: (id) => adminCall<AdminProduct>(`/products/${id}`, 'GET'),
  createProduct: (input) => adminCall<AdminProduct>('/products', 'POST', productBody(input)),
  updateProduct: (id, input) => adminCall<AdminProduct>(`/products/${id}`, 'PATCH', productBody(input)),
  async deleteProduct(id) {
    await adminCall(`/products/${id}`, 'DELETE');
  },
  importProducts: (fileName, rows) =>
    adminCall<ImportResult>('/products/import', 'POST', { file_name: fileName, rows }),

  async getVariants(productId) {
    const res = await adminCall<{ items: AdminVariant[] }>(`/products/${productId}/variants`, 'GET');
    return res.items;
  },
  createVariant: (productId, input) => adminCall<AdminVariant>(`/products/${productId}/variants`, 'POST', variantBody(input)),
  updateVariant: (id, input) => adminCall<AdminVariant>(`/variants/${id}`, 'PATCH', variantBody(input)),
  async deleteVariant(id) {
    await adminCall(`/variants/${id}`, 'DELETE');
  },
  uploadVariantImage: (id, thumb, main) => {
    const form = new FormData();
    form.set('thumb', thumb, 'thumb.webp');
    form.set('main', main, 'main.webp');
    return adminCallForm<AdminVariant>(`/variants/${id}/image`, form);
  },

  async getCategories() {
    const res = await adminCall<{ items: AdminCategory[] }>('/categories', 'GET');
    return res.items;
  },
  createCategory: (input) =>
    adminCall<AdminCategory>('/categories', 'POST', {
      name: input.name,
      icon: input.icon,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    }),
  updateCategory: (id, input) => adminCall<AdminCategory>(`/categories/${id}`, 'PATCH', categoryBody(input)),
  async deleteCategory(id) {
    await adminCall(`/categories/${id}`, 'DELETE');
  },

  async getBrands() {
    const res = await adminCall<{ items: AdminBrand[] }>('/brands', 'GET');
    return res.items;
  },
  createBrand: (input) => adminCall<AdminBrand>('/brands', 'POST', brandBody(input)),
  updateBrand: (id, input) => adminCall<AdminBrand>(`/brands/${id}`, 'PATCH', brandBody(input)),
  async deleteBrand(id) {
    await adminCall(`/brands/${id}`, 'DELETE');
  },

  async getRegions() {
    const res = await adminCall<{ items: AdminRegion[] }>('/regions', 'GET');
    return res.items;
  },
  createRegion: (input) => adminCall<AdminRegion>('/regions', 'POST', regionBody(input)),
  updateRegion: (id, input) => adminCall<AdminRegion>(`/regions/${id}`, 'PATCH', regionBody(input)),
  async deleteRegion(id) {
    await adminCall(`/regions/${id}`, 'DELETE');
  },

  async getBanners() {
    const res = await adminCall<{ items: AdminBanner[] }>('/banners', 'GET');
    return res.items;
  },
  createBanner: (input) =>
    // image_path is never sent: the server never accepts it from the client
    // (validateBannerWriteBody drops it) — the banner starts out with no
    // image, invisible to customers, until uploadBannerImage sets one.
    adminCall<AdminBanner>('/banners', 'POST', {
      title: input.title,
      subtitle: input.subtitle,
      link_type: input.linkType,
      link_id: input.linkId,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    }),
  updateBanner: (id, input) => adminCall<AdminBanner>(`/banners/${id}`, 'PATCH', bannerBody(input)),
  async deleteBanner(id) {
    await adminCall(`/banners/${id}`, 'DELETE');
  },
  uploadBannerImage: (id, image) => {
    const form = new FormData();
    form.set('image', image, 'image.webp');
    return adminCallForm<AdminBanner>(`/banners/${id}/image`, form);
  },

  async getOrders({ status, regionId, page }) {
    const qs = new URLSearchParams({ page: String(page) });
    if (status !== undefined) qs.set('status', status);
    if (regionId !== undefined) qs.set('region_id', String(regionId));
    const res = await adminCall<{ items: AdminOrderSummary[]; page: number; total: number | null }>(
      `/orders?${qs.toString()}`,
      'GET',
    );
    return { items: res.items, total: res.total ?? res.items.length, page: res.page };
  },
  getOrder: (id) => adminCall<AdminOrderDetail>(`/orders/${id}`, 'GET'),
  async setOrderStatus(id, status, trackingNote) {
    const res = await adminCall<{ ok: true; order_id: number; status: OrderStatus }>(`/orders/${id}/status`, 'POST', {
      status,
      tracking_note: trackingNote,
    });
    return { order_id: res.order_id, status: res.status };
  },

  getSettings: () => adminCall<SettingsData>('/settings', 'GET'),
  updateSettings: (input) => adminCall<SettingsData>('/settings', 'PATCH', settingsBody(input)),

  async getAdmins() {
    const res = await adminCall<{ items: AdminUserRow[] }>('/admins', 'GET');
    return res.items;
  },
  addAdmin: (telegramId) => adminCall<AdminUserRow>('/admins', 'POST', { telegram_id: telegramId, role: 'admin' }),
  async deleteAdmin(telegramId) {
    await adminCall(`/admins/${telegramId}`, 'DELETE');
  },

  async getAudit(page) {
    const res = await adminCall<{ items: AuditLogEntry[]; page: number; total: number | null }>(
      `/audit?page=${page}`,
      'GET',
    );
    return { items: res.items, total: res.total ?? res.items.length, page: res.page };
  },
};

export type { Paged };
