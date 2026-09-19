// Real API client: a single request() against config.apiUrl. Public GETs hit
// `${apiUrl}/public/*` with no auth header (they're cacheable, anonymous
// catalog reads — see api/src/routes/public.ts); every other call hits
// `${apiUrl}/*` with `Authorization: tma <initData>` (api/src/routes/customer.ts).

import { config } from './config.ts';
import { getInitData } from './telegram.ts';
import { ApiError } from './apiError.ts';
import { setAuthInvalid } from './authState.ts';
import { setChannelRequired } from './channelState.ts';
import type {
  AddressInput,
  ApiClient,
  OrderCreateInput,
  OrderCreateResult,
  OrdersPage,
  ProfileUpdateInput,
} from './client.ts';
import type {
  Address,
  Banner,
  Brand,
  Category,
  Me,
  OrderDetail,
  OrderSummary,
  Product,
  ProductDetail,
  ProductsPage,
  ProductsQuery,
  PublicSettings,
  Region,
} from './types.ts';

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.auth === true) {
    const initData = getInitData();
    if (initData === null) {
      setAuthInvalid(true);
      throw new ApiError(401, 'auth_invalid', 'Not running inside Telegram');
    }
    headers['Authorization'] = `tma ${initData}`;
  }

  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

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
    if (res.status === 403 && code === 'channel_required') {
      setChannelRequired(true);
    }
    throw new ApiError(res.status, code, error.message ?? 'Request failed', error.details);
  }

  return json as T;
}

function publicGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  let query = '';
  if (params !== undefined) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, String(value));
    }
    const qs = search.toString();
    if (qs.length > 0) query = `?${qs}`;
  }
  return request<T>(`/public${path}${query}`);
}

function sortToParam(sort: ProductsQuery['sort']): string {
  switch (sort) {
    case 'cheap':
      return 'price_asc';
    case 'expensive':
      return 'price_desc';
    case 'discount':
      return 'discount';
    case 'popular':
    default:
      return 'popular';
  }
}

async function getProducts(query: ProductsQuery): Promise<ProductsPage> {
  const data = await publicGet<{ items: Product[]; total: number; page: number; page_size: number }>('/products', {
    category_id: query.categoryId,
    brand_id: query.brandId,
    q: query.q !== undefined && query.q.trim().length > 0 ? query.q.trim() : undefined,
    sort: sortToParam(query.sort),
    discount_only: query.discount === true ? 1 : undefined,
    page: query.page,
  });
  return { items: data.items, total: data.total, page: data.page, pageSize: data.page_size };
}

async function getProductsByIds(ids: number[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const data = await publicGet<{ items: Product[] }>('/products/by-ids', { ids: ids.join(',') });
  return data.items;
}

export const apiClient: ApiClient = {
  getSettings: () => publicGet<PublicSettings>('/settings'),
  getCategories: async () => (await publicGet<{ items: Category[] }>('/categories')).items,
  getBrands: async () => (await publicGet<{ items: Brand[] }>('/brands')).items,
  getRegions: async () => (await publicGet<{ items: Region[] }>('/regions')).items,
  getBanners: async () => (await publicGet<{ items: Banner[] }>('/banners')).items,
  getProducts,
  getProductsByIds,
  getProductById: (id: number) => publicGet<ProductDetail>(`/products/${id}`),

  getMe: () => request<Me>('/me', { auth: true }),
  patchMe: (input: ProfileUpdateInput) =>
    request<Me>('/me', {
      method: 'PATCH',
      auth: true,
      body: { first_name: input.firstName, last_name: input.lastName, phone: input.phone },
    }),
  postContact: (response: string) => request<Me>('/me/contact', { method: 'POST', auth: true, body: { response } }),
  postChannelCheck: async () => {
    const me = await request<Me>('/me/channel-check', { method: 'POST', auth: true });
    // Clear the global flag as soon as the server agrees, so the gate screen
    // stops overriding the fresh /me snapshot.
    setChannelRequired(me.channel_required);
    return me;
  },

  getFavorites: async () => (await request<{ items: Product[] }>('/favorites', { auth: true })).items,
  putFavorite: (productId: number) => request(`/favorites/${productId}`, { method: 'PUT', auth: true }),
  deleteFavorite: (productId: number) => request(`/favorites/${productId}`, { method: 'DELETE', auth: true }),

  getAddresses: async () => (await request<{ items: Address[] }>('/addresses', { auth: true })).items,
  postAddress: (input: AddressInput) =>
    request<Address>('/addresses', {
      method: 'POST',
      auth: true,
      body: {
        region_id: input.regionId,
        label: input.label,
        text: input.text,
        lat: input.lat,
        lng: input.lng,
        is_default: input.isDefault,
      },
    }),
  patchAddress: (id: number, input: AddressInput) =>
    request<Address>(`/addresses/${id}`, {
      method: 'PATCH',
      auth: true,
      body: {
        region_id: input.regionId,
        label: input.label,
        text: input.text,
        lat: input.lat,
        lng: input.lng,
        is_default: input.isDefault,
      },
    }),
  deleteAddress: (id: number) => request(`/addresses/${id}`, { method: 'DELETE', auth: true }),

  postOrder: (input: OrderCreateInput) =>
    request<OrderCreateResult>('/orders', {
      method: 'POST',
      auth: true,
      body: {
        idempotency_key: input.idempotencyKey,
        delivery_type: input.deliveryType,
        region_id: input.regionId,
        address_text: input.addressText,
        lat: input.lat,
        lng: input.lng,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        comment: input.comment,
        payment_method: input.paymentMethod,
        items: input.items,
      },
    }),
  getOrders: async (page: number) => {
    const data = await request<{ items: OrderSummary[]; total: number; page: number; page_size: number }>(
      `/orders?page=${page}`,
      { auth: true },
    );
    return { items: data.items, total: data.total, page: data.page, pageSize: data.page_size } satisfies OrdersPage;
  },
  getOrderById: (id: number) => request<OrderDetail>(`/orders/${id}`, { auth: true }),
};
