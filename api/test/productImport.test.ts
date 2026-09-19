import { describe, expect, it } from 'vitest';
import { importProductRow, type ProductImportStore } from '../src/lib/productImport';
import type { ImportedVariantRow } from '@dunyo/shared';

const row: ImportedVariantRow = {
  name: 'iPhone 15',
  brandId: 1,
  categoryId: 1,
  colorName: 'Qora',
  storageGb: 128,
  price: 12_000_000,
  oldPrice: null,
  stock: 10,
  warrantyMonths: 12,
  sku: 'A-1',
};

interface FakeStoreOptions {
  productLookup?: { id: number | null; error: string | null };
  variantLookup?: { id: number | null; error: string | null };
  writeError?: string | null;
}

function fakeStore(options: FakeStoreOptions = {}) {
  const productLookup = options.productLookup ?? { id: 1, error: null };
  const variantLookup = options.variantLookup ?? { id: null, error: null };
  const writeError = options.writeError ?? null;
  const calls = { findOrCreateProduct: 0, findVariant: 0, update: 0, insert: 0 };
  const store: ProductImportStore = {
    findOrCreateProductId: () => {
      calls.findOrCreateProduct += 1;
      return Promise.resolve(productLookup);
    },
    findVariantId: () => {
      calls.findVariant += 1;
      return Promise.resolve(variantLookup);
    },
    updateVariant: () => {
      calls.update += 1;
      return Promise.resolve(writeError);
    },
    insertVariant: () => {
      calls.insert += 1;
      return Promise.resolve(writeError);
    },
  };
  return { store, calls };
}

describe('importProductRow', () => {
  it('a product lookup/create error fails the row without touching variants', async () => {
    const { store, calls } = fakeStore({ productLookup: { id: null, error: 'connection reset' } });
    const outcome = await importProductRow(store, row);
    expect(outcome.kind).toBe('failed');
    expect(calls.findVariant).toBe(0);
    expect(calls.insert).toBe(0);
    expect(calls.update).toBe(0);
  });

  it('an existing variant is updated', async () => {
    const { store, calls } = fakeStore({ variantLookup: { id: 7, error: null } });
    const outcome = await importProductRow(store, row);
    expect(outcome.kind).toBe('updated');
    expect(calls.update).toBe(1);
    expect(calls.insert).toBe(0);
  });

  it('a missing variant is inserted under the resolved product', async () => {
    const { store, calls } = fakeStore({ productLookup: { id: 3, error: null }, variantLookup: { id: null, error: null } });
    const outcome = await importProductRow(store, row);
    expect(outcome.kind).toBe('created');
    expect(calls.insert).toBe(1);
    expect(calls.update).toBe(0);
  });

  it('a variant lookup error fails the row without writing', async () => {
    const { store, calls } = fakeStore({ variantLookup: { id: null, error: 'connection reset' } });
    const outcome = await importProductRow(store, row);
    expect(outcome.kind).toBe('failed');
    expect(calls.insert).toBe(0);
    expect(calls.update).toBe(0);
  });

  it('a write error is reported', async () => {
    const { store } = fakeStore({ variantLookup: { id: null, error: null }, writeError: 'duplicate key' });
    const outcome = await importProductRow(store, row);
    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.error).toBe('duplicate key');
    }
  });
});
