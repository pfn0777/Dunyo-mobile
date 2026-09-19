import { describe, expect, it } from 'vitest';
import { validateImportRow } from '@dunyo/shared';
import { buildKnownNameMap, normalizeImportKey } from '../importKnownMaps.ts';

// api/src/lib/importKnownMaps.ts's normalizeImportKey is a server-side
// duplicate of shared/src/importValidation.ts's private, unexported
// normalizeKey (trim, lowercase, fold curly/backtick apostrophe variants to
// a straight one). This client-side copy must agree with BOTH of them, or a
// brand/category name that resolves in the server-side import could still
// fail to resolve in the admin panel's preview table. Since normalizeKey is
// not exported, agreement is proven behaviorally: validateImportRow (the
// real shared function the server also calls) must resolve a row whose
// brand/category spelling differs only in case/apostrophe style from what
// buildKnownNameMap indexed.
describe('normalizeImportKey', () => {
  it('trims, lowercases, and folds apostrophe variants to a straight one', () => {
    expect(normalizeImportKey("  Bo'ka  ")).toBe("bo'ka");
    expect(normalizeImportKey('Bo‘ka')).toBe("bo'ka"); // left single quote
    expect(normalizeImportKey('Bo’ka')).toBe("bo'ka"); // right single quote
    expect(normalizeImportKey('Bo`ka')).toBe("bo'ka"); // backtick
  });
});

describe('buildKnownNameMap agrees with @dunyo/shared validateImportRow', () => {
  it('resolves a brand/category typed with different case and apostrophe style than the stored name', () => {
    const knownBrands = buildKnownNameMap([{ id: 8, name: "Bo'ka" }]);
    const knownCategories = buildKnownNameMap([{ id: 5, name: 'Zaryadlovchilar' }]);

    const row = {
      nomi: 'Test mahsulot',
      brend: 'BO‘KA', // uppercase + left curly apostrophe, stored as straight lowercase
      kategoriya: '  zaryadlovchilar  ',
      rang: 'Qora',
      xotira: '',
      narxi: 100000,
      eski_narxi: '',
      qoldigi: 5,
      kafolat_oyi: 12,
      artikul: '',
    };

    const result = validateImportRow(row, 1, knownBrands, knownCategories);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.brandId).toBe(8);
      expect(result.value.categoryId).toBe(5);
    }
  });

  it('fails to resolve a name that truly is not in the map', () => {
    const knownBrands = buildKnownNameMap([{ id: 1, name: 'Apple' }]);
    const knownCategories = buildKnownNameMap([{ id: 1, name: 'Smartfonlar' }]);
    const row = {
      nomi: 'Test',
      brend: 'Nokia',
      kategoriya: 'Smartfonlar',
      rang: 'Qora',
      narxi: 100000,
      qoldigi: 1,
    };
    const result = validateImportRow(row, 1, knownBrands, knownCategories);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('Brend topilmadi'))).toBe(true);
    }
  });
});
