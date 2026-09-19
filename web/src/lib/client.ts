import type {
  Address,
  Banner,
  Brand,
  Category,
  DeliveryType,
  Me,
  OrderDetail,
  OrderSummary,
  PaymentMethod,
  Product,
  ProductDetail,
  ProductsPage,
  ProductsQuery,
  PublicSettings,
  Region,
} from './types.ts';

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

export interface OrderCreateResult {
  order_id: number;
  order_no: string;
  duplicate: boolean;
}

export interface ProfileUpdateInput {
  firstName?: string;
  lastName?: string | null;
  phone?: string;
}

export interface AddressInput {
  regionId: number | null;
  label: string | null;
  text: string;
  lat: number | null;
  lng: number | null;
  isDefault: boolean;
}

export interface OrdersPage {
  items: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
}

/** Contract implemented by both the real API-backed client (api.ts) and the
 * in-memory mock (mock.ts) used when VITE_MOCK=1. Pages depend only on this
 * interface so the mock can be swapped in without touching UI code. */
export interface ApiClient {
  getSettings(): Promise<PublicSettings>;
  getCategories(): Promise<Category[]>;
  getBrands(): Promise<Brand[]>;
  getRegions(): Promise<Region[]>;
  getBanners(): Promise<Banner[]>;
  getProducts(query: ProductsQuery): Promise<ProductsPage>;
  getProductsByIds(ids: number[]): Promise<Product[]>;
  getProductById(id: number): Promise<ProductDetail>;

  getMe(): Promise<Me>;
  patchMe(input: ProfileUpdateInput): Promise<Me>;
  postContact(response: string): Promise<Me>;
  /** Forces a fresh channel-membership check after the user says they joined. */
  postChannelCheck(): Promise<Me>;

  getFavorites(): Promise<Product[]>;
  putFavorite(productId: number): Promise<void>;
  deleteFavorite(productId: number): Promise<void>;

  getAddresses(): Promise<Address[]>;
  postAddress(input: AddressInput): Promise<Address>;
  patchAddress(id: number, input: AddressInput): Promise<Address>;
  deleteAddress(id: number): Promise<void>;

  postOrder(input: OrderCreateInput): Promise<OrderCreateResult>;
  getOrders(page: number): Promise<OrdersPage>;
  getOrderById(id: number): Promise<OrderDetail>;
}

let cached: Promise<ApiClient> | null = null;

/**
 * Resolves the active API client. `import.meta.env.VITE_MOCK` is inlined by
 * Vite at build time, so when it is not '1' this whole branch (and the
 * dynamic import of mock.ts, with its in-memory catalog strings) is dead
 * code and gets tree-shaken out of the production bundle.
 */
export function getClient(): Promise<ApiClient> {
  if (cached === null) {
    cached =
      import.meta.env.VITE_MOCK === '1'
        ? import('./mock.ts').then((m) => m.createMockClient())
        : import('./api.ts').then((m) => m.apiClient);
  }
  return cached;
}
