import type { Queryable } from './queryable.ts';

export interface VariantFixtureInput {
  colorName: string;
  colorHex?: string | null;
  storageGb?: number | null;
  price: number;
  oldPrice?: number | null;
  stock: number;
  isActive?: boolean;
  sku?: string | null;
}

export interface ProductWithVariantsInput {
  name: string;
  brandId: number;
  categoryId: number;
  warrantyMonths?: number;
  isActive?: boolean;
  variants: VariantFixtureInput[];
}

export interface ProductWithVariantsResult {
  productId: number;
  variantIds: number[];
}

export interface RegionFixtureInput {
  name?: string;
  deliveryFee?: number;
  freeDeliveryThreshold?: number | null;
  isActive?: boolean;
}

let brandCounter = 0;
let categoryCounter = 0;
let regionCounter = 0;

export async function insertUser(db: Queryable, id: number, firstName = 'Test User'): Promise<void> {
  await db.query('insert into public.users (id, first_name) values ($1, $2)', [id, firstName]);
}

export async function insertBrand(db: Queryable, name?: string): Promise<number> {
  const brandName = name ?? `Brand ${++brandCounter}`;
  const res = await db.query<{ id: number }>(
    'insert into public.brands (name) values ($1) returning id',
    [brandName],
  );
  return res.rows[0]!.id;
}

export async function insertCategory(db: Queryable, name?: string): Promise<number> {
  const categoryName = name ?? `Category ${++categoryCounter}`;
  const res = await db.query<{ id: number }>(
    'insert into public.categories (name) values ($1) returning id',
    [categoryName],
  );
  return res.rows[0]!.id;
}

export async function insertRegion(db: Queryable, input: RegionFixtureInput = {}): Promise<number> {
  const name = input.name ?? `Region ${++regionCounter}`;
  const res = await db.query<{ id: number }>(
    `insert into public.regions (name, delivery_fee, free_delivery_threshold, is_active)
     values ($1, $2, $3, $4)
     returning id`,
    [name, input.deliveryFee ?? 15000, input.freeDeliveryThreshold ?? null, input.isActive ?? true],
  );
  return res.rows[0]!.id;
}

/**
 * Inserts a product together with one or more variants (color + storage +
 * price + stock). Returns the product id and the variant ids in insertion
 * order, so callers can pick out `variantIds[0]`, etc.
 */
export async function insertProductWithVariants(
  db: Queryable,
  input: ProductWithVariantsInput,
): Promise<ProductWithVariantsResult> {
  const productRes = await db.query<{ id: number }>(
    `insert into public.products (name, brand_id, category_id, warranty_months, is_active)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [input.name, input.brandId, input.categoryId, input.warrantyMonths ?? 12, input.isActive ?? true],
  );
  const productId = productRes.rows[0]!.id;

  const variantIds: number[] = [];
  for (const v of input.variants) {
    const variantRes = await db.query<{ id: number }>(
      `insert into public.product_variants
         (product_id, color_name, color_hex, storage_gb, price, old_price, stock, is_active, sku)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id`,
      [
        productId,
        v.colorName,
        v.colorHex ?? null,
        v.storageGb ?? null,
        v.price,
        v.oldPrice ?? null,
        v.stock,
        v.isActive ?? true,
        v.sku ?? null,
      ],
    );
    variantIds.push(variantRes.rows[0]!.id);
  }

  return { productId, variantIds };
}

export async function getVariantStock(db: Queryable, variantId: number): Promise<number> {
  const res = await db.query<{ stock: number }>(
    'select stock from public.product_variants where id = $1',
    [variantId],
  );
  const row = res.rows[0];
  if (!row) {
    throw new Error(`variant ${variantId} not found`);
  }
  return row.stock;
}

export async function getProductSoldCount(db: Queryable, productId: number): Promise<number> {
  const res = await db.query<{ sold_count: number }>(
    'select sold_count from public.products where id = $1',
    [productId],
  );
  const row = res.rows[0];
  if (!row) {
    throw new Error(`product ${productId} not found`);
  }
  return row.sold_count;
}

export async function setProductActive(db: Queryable, productId: number, isActive: boolean): Promise<void> {
  await db.query('update public.products set is_active = $1 where id = $2', [isActive, productId]);
}

export async function setVariantActive(db: Queryable, variantId: number, isActive: boolean): Promise<void> {
  await db.query('update public.product_variants set is_active = $1 where id = $2', [isActive, variantId]);
}

export async function setSettings(
  db: Queryable,
  settings: Partial<{
    minOrderAmount: number;
    freeDeliveryThreshold: number;
    deliveryEnabled: boolean;
    installmentMonths: number;
  }>,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (settings.minOrderAmount !== undefined) {
    fields.push(`min_order_amount = $${i++}`);
    values.push(settings.minOrderAmount);
  }
  if (settings.freeDeliveryThreshold !== undefined) {
    fields.push(`free_delivery_threshold = $${i++}`);
    values.push(settings.freeDeliveryThreshold);
  }
  if (settings.deliveryEnabled !== undefined) {
    fields.push(`delivery_enabled = $${i++}`);
    values.push(settings.deliveryEnabled);
  }
  if (settings.installmentMonths !== undefined) {
    fields.push(`installment_months = $${i++}`);
    values.push(settings.installmentMonths);
  }
  if (fields.length === 0) {
    return;
  }
  await db.query(`update public.settings set ${fields.join(', ')} where id = 1`, values);
}
