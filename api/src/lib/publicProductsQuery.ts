// Pure query-string decisions for GET /api/public/products and
// GET /api/public/products/by-ids — extracted out of the route handler so
// the clamping/allow-list logic is unit-testable without a DB or an HTTP
// request. Every value that reaches SQL from here is either a clamped
// integer or a literal picked from a fixed allow-list — the route never
// concatenates a raw query-string value into `order by`.

export const PRODUCTS_PAGE_SIZE = 20;
export const PRODUCTS_BY_IDS_MAX = 100;

export type ProductsSort = 'popular' | 'cheap' | 'expensive' | 'discount';

const SORT_VALUES: readonly ProductsSort[] = ['popular', 'cheap', 'expensive', 'discount'];

/** Fixed, literal SQL order-by fragments — never built from user input. The
 * route selects one of these by key; it never interpolates `sort` itself. */
export const PRODUCTS_SORT_SQL: Readonly<Record<ProductsSort, string>> = {
  // sold_count is on products; ties broken by id for a stable order.
  popular: 'p.sold_count desc, p.id desc',
  cheap: 'va.min_price asc, p.id asc',
  expensive: 'va.min_price desc, p.id asc',
  // XUMO approximated "biggest discount" with `old_price desc`. Dunyo has
  // both min_price and old_price available per product, so it computes the
  // real percentage discount here instead of that approximation.
  discount: '(mpv.old_price - va.min_price)::numeric / nullif(mpv.old_price, 0) desc nulls last, p.id desc',
};

function isProductsSort(value: string): value is ProductsSort {
  return (SORT_VALUES as readonly string[]).includes(value);
}

function parsePage(raw: string | undefined): number {
  if (raw === undefined) {
    return 1;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

/** Parses a query id param (category_id/brand_id) as a positive integer;
 * anything else (missing, junk, zero, negative, float) becomes null,
 * meaning "no filter" rather than a thrown error. */
function parseOptionalId(raw: string | undefined): number | null {
  if (raw === undefined) {
    return null;
  }
  if (!/^[1-9]\d*$/.test(raw)) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export interface ProductsListQuery {
  page: number;
  q: string | null;
  categoryId: number | null;
  brandId: number | null;
  discountOnly: boolean;
  sort: ProductsSort;
}

export interface RawProductsListQuery {
  page?: string;
  q?: string;
  category_id?: string;
  brand_id?: string;
  discount_only?: string;
  sort?: string;
}

/**
 * Normalizes GET /api/public/products query params. Junk input never
 * throws: an invalid page becomes 1, an invalid sort becomes "popular", an
 * unparsable id filter is dropped rather than passed through to SQL.
 */
export function parseProductsListQuery(raw: RawProductsListQuery): ProductsListQuery {
  const q = raw.q !== undefined && raw.q.trim().length > 0 ? raw.q.trim() : null;
  const sort = raw.sort !== undefined && isProductsSort(raw.sort) ? raw.sort : 'popular';

  return {
    page: parsePage(raw.page),
    q,
    categoryId: parseOptionalId(raw.category_id),
    brandId: parseOptionalId(raw.brand_id),
    discountOnly: raw.discount_only === '1',
    sort,
  };
}

/**
 * Parses `?ids=1,2,3` for the by-ids reconcile endpoint: caps at 100 ids and
 * silently drops any entry that is not a positive integer, rather than
 * rejecting the whole request over one bad entry.
 */
export function parseIdsParam(raw: string | undefined, max: number = PRODUCTS_BY_IDS_MAX): number[] {
  if (raw === undefined || raw.trim().length === 0) {
    return [];
  }
  const ids: number[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!/^[1-9]\d*$/.test(trimmed)) {
      continue;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isSafeInteger(parsed)) {
      ids.push(parsed);
    }
    if (ids.length >= max) {
      break;
    }
  }
  return ids;
}
