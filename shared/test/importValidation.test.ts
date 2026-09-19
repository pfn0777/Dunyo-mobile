import { describe, expect, it } from 'vitest';
import { validateImportRow } from '../src/importValidation.ts';

const brands = new Map<string, number>([
  ['apple', 1],
  ['samsung', 2],
]);

const categories = new Map<string, number>([
  ['smartfonlar', 1],
  ['planshetlar', 2],
]);

function baseRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nomi: 'iPhone 15',
    brend: 'Apple',
    kategoriya: 'Smartfonlar',
    rang: "Ko'k",
    xotira: 128,
    narxi: 17800000,
    eski_narxi: '',
    qoldigi: 5,
    kafolat_oyi: '',
    artikul: '',
    ...overrides,
  };
}

describe('validateImportRow', () => {
  it('rejects an empty name', () => {
    const result = validateImportRow(baseRow({ nomi: '' }), 2, brands, categories);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('Nomi'))).toBe(true);
    }
  });

  it('rejects a non-positive price', () => {
    const result = validateImportRow(baseRow({ narxi: -100 }), 3, brands, categories);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('Narxi'))).toBe(true);
    }
  });

  it('rejects an unknown brand', () => {
    const result = validateImportRow(baseRow({ brend: "Noma'lum" }), 4, brands, categories);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('Brend topilmadi'))).toBe(true);
    }
  });

  it('rejects an unknown category', () => {
    const result = validateImportRow(baseRow({ kategoriya: "Noma'lum bo'lim" }), 5, brands, categories);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('Kategoriya topilmadi'))).toBe(true);
    }
  });

  it('rejects a non-numeric xotira value', () => {
    const result = validateImportRow(baseRow({ xotira: 'katta' }), 6, brands, categories);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('Xotira'))).toBe(true);
    }
  });

  it('rejects eski_narxi that is not strictly greater than narxi', () => {
    const equal = validateImportRow(baseRow({ narxi: 100000, eski_narxi: 100000 }), 7, brands, categories);
    expect(equal.ok).toBe(false);
    if (!equal.ok) {
      expect(equal.errors.some((e) => e.includes('Eski narxi'))).toBe(true);
    }

    const lower = validateImportRow(baseRow({ narxi: 100000, eski_narxi: 90000 }), 8, brands, categories);
    expect(lower.ok).toBe(false);
    if (!lower.ok) {
      expect(lower.errors.some((e) => e.includes('Eski narxi'))).toBe(true);
    }
  });

  it('accepts a price written with spaces as thousand separators', () => {
    const result = validateImportRow(baseRow({ narxi: '1 200 000' }), 9, brands, categories);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.price).toBe(1200000);
    }
  });

  it('defaults an empty kafolat_oyi to 12', () => {
    const result = validateImportRow(baseRow({ kafolat_oyi: '' }), 10, brands, categories);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.warrantyMonths).toBe(12);
    }
  });

  it('reports every problem on a row with several errors at once', () => {
    const result = validateImportRow(
      baseRow({ nomi: '', brend: "Noma'lum", narxi: -5, xotira: 'katta' }),
      11,
      brands,
      categories,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
      expect(result.errors.some((e) => e.includes('Nomi'))).toBe(true);
      expect(result.errors.some((e) => e.includes('Brend topilmadi'))).toBe(true);
      expect(result.errors.some((e) => e.includes('Narxi'))).toBe(true);
      expect(result.errors.some((e) => e.includes('Xotira'))).toBe(true);
    }
  });

  it('resolves headers regardless of case/whitespace, and brand/category names regardless of curly apostrophes', () => {
    const curlyBrands = new Map<string, number>([["o'zbek tech", 9]]);
    const result = validateImportRow(
      {
        ' Nomi ': 'Galaxy S24',
        Brend: 'O’zbek Tech', // curly apostrophe in the value, map key uses a straight one
        Kategoriya: 'Smartfonlar',
        Rang: 'Kumush',
        Xotira: 256,
        Narxi: '14 200 000',
        Eski_narxi: '15 000 000',
        Qoldigi: 12,
        Kafolat_oyi: 24,
        Artikul: 'SKU-001',
      },
      12,
      curlyBrands,
      categories,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Galaxy S24');
      expect(result.value.brandId).toBe(9);
      expect(result.value.categoryId).toBe(1);
      expect(result.value.price).toBe(14200000);
      expect(result.value.oldPrice).toBe(15000000);
      expect(result.value.stock).toBe(12);
      expect(result.value.warrantyMonths).toBe(24);
      expect(result.value.sku).toBe('SKU-001');
    }
  });

  it('treats missing xotira as no storage variant', () => {
    const result = validateImportRow(baseRow({ xotira: '' }), 13, brands, categories);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.storageGb).toBeNull();
    }
  });

  it('treats a blank artikul as no SKU (auto upsert key by name/brand/color/storage)', () => {
    const result = validateImportRow(baseRow({ artikul: '' }), 14, brands, categories);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sku).toBeNull();
    }
  });
});
