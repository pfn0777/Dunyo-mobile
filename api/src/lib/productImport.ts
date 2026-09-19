// Upserts one validated import row. The DB is reached through a narrow store
// interface so the decision logic is unit-testable without Postgres. A failed
// lookup must never fall through to an insert: that would create a duplicate
// product/variant on a transient DB error.
//
// Unlike XUMO (flat products), a phone row resolves/creates a `products` row
// first, then upserts a `product_variants` row underneath it. The upsert key
// for the variant is `sku` when the row has one, else the
// (name, brand_id, color_name, storage_gb) combination.

import type { ImportedVariantRow } from '@dunyo/shared';

export interface ProductImportStore {
  /** Finds the product this row belongs to (by name + brand), creating it
   * when it does not exist yet. */
  findOrCreateProductId(row: ImportedVariantRow): Promise<{ id: number | null; error: string | null }>;
  /** Finds the existing variant under `productId` matching this row's upsert
   * key (sku, else name/brand/color/storage). */
  findVariantId(productId: number, row: ImportedVariantRow): Promise<{ id: number | null; error: string | null }>;
  updateVariant(variantId: number, productId: number, row: ImportedVariantRow): Promise<string | null>;
  insertVariant(productId: number, row: ImportedVariantRow): Promise<string | null>;
}

export type ImportRowOutcome =
  | { kind: 'created' }
  | { kind: 'updated' }
  | { kind: 'failed'; error: string };

export async function importProductRow(store: ProductImportStore, row: ImportedVariantRow): Promise<ImportRowOutcome> {
  const product = await store.findOrCreateProductId(row);
  if (product.error !== null) {
    return { kind: 'failed', error: product.error };
  }
  if (product.id === null) {
    return { kind: 'failed', error: 'product resolution returned no id' };
  }

  const variant = await store.findVariantId(product.id, row);
  if (variant.error !== null) {
    return { kind: 'failed', error: variant.error };
  }

  if (variant.id !== null) {
    const error = await store.updateVariant(variant.id, product.id, row);
    return error === null ? { kind: 'updated' } : { kind: 'failed', error };
  }

  const error = await store.insertVariant(product.id, row);
  return error === null ? { kind: 'created' } : { kind: 'failed', error };
}
