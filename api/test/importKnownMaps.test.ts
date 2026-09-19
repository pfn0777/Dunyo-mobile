import { describe, expect, it } from 'vitest';
import { validateImportRow } from '@dunyo/shared';
import { buildKnownNameMap, normalizeImportKey } from '../src/lib/importKnownMaps';

describe('normalizeImportKey', () => {
  it('trims and lowercases', () => {
    expect(normalizeImportKey('  Apple  ')).toBe('apple');
  });

  it('folds curly/backtick apostrophe variants to a straight one', () => {
    expect(normalizeImportKey('Qoraoʻg’ Brand')).toBe("qorao'g' brand");
    expect(normalizeImportKey('O`zbek')).toBe("o'zbek");
  });
});

describe('buildKnownNameMap', () => {
  it('maps normalized names to ids', () => {
    const map = buildKnownNameMap([
      { id: 1, name: 'Apple' },
      { id: 2, name: 'Samsung' },
    ]);
    expect(map.get('apple')).toBe(1);
    expect(map.get('samsung')).toBe(2);
  });

  // The map this module builds is fed directly into @dunyo/shared's
  // validateImportRow as knownBrands/knownCategories. If the normalization
  // here ever drifted from importValidation.ts's private normalizeKey, an
  // Excel row referencing a brand by an apostrophe variant different from
  // how it's stored in the DB would wrongly fail as "brand not found" even
  // though the same row passes shared's own apostrophe-tolerance tests.
  it('stays consistent with validateImportRow apostrophe tolerance end-to-end', () => {
    const knownBrands = buildKnownNameMap([{ id: 7, name: "Qoraoʻg’on" }]);
    const knownCategories = buildKnownNameMap([{ id: 3, name: 'Smartfonlar' }]);

    const row = {
      nomi: 'Test phone',
      brend: "Qorao'g'on", // straight apostrophes, DB has curly ones
      kategoriya: 'Smartfonlar',
      rang: 'Qora',
      xotira: '128',
      narxi: '5000000',
      qoldigi: '3',
    };

    const result = validateImportRow(row, 1, knownBrands, knownCategories);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.brandId).toBe(7);
      expect(result.value.categoryId).toBe(3);
    }
  });
});
